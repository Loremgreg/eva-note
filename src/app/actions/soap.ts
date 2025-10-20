"use server";

// Server Actions for SOAP note generation and management
// Based on PRD section 5: SOAP generation with Azure OpenAI + retry logic

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateObject } from "ai";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getAzureModel } from "@/lib/azure-openai";
import {
  getSoapSystemPrompt,
  createSoapUserPrompt,
} from "@/lib/prompts";
import { SoapSchema, NoteSchema } from "@/lib/schemas";
import { cleanTranscript, validateTranscriptLength, hashTranscript } from "@/lib/transcript-utils";
import { createUsageMetrics, estimateTokenCount } from "@/lib/metrics";
import type {
  Note,
  NoteInsert,
  NoteUpdate,
  TranscriptInsert,
  SoapNote,
  LanguagePref,
} from "@/lib/database.types";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 3000]; // 1s, 2s, 3s

/**
 * Gets the current user's profile ID
 */
async function getCurrentProfileId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Non authentifié. Veuillez vous connecter.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (error || !profile) {
    throw new Error("Profil utilisateur introuvable.");
  }

  return profile.id;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Saves transcript to database
 * @param visitId Visit UUID
 * @param text Cleaned transcript text
 * @param rawJson Optional raw Deepgram JSON
 * @param language Language code
 * @param confidence Confidence score
 */
async function saveTranscript(
  visitId: string,
  text: string,
  rawJson?: any,
  language?: string,
  confidence?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    const transcriptInsert: TranscriptInsert = {
      visit_id: visitId,
      text,
      raw_json: rawJson,
      language,
      confidence,
    };

    const { error } = await supabase.from("transcripts").insert(transcriptInsert);

    if (error) {
      console.error("[saveTranscript] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la sauvegarde du transcript.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[saveTranscript] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}

/**
 * Generates SOAP note from transcript using Azure OpenAI with retry logic
 * @param rawText Raw transcript or manual input text
 * @param language Language preference
 * @param detail Detail level (concise or detailed)
 * @param bodyRegion Optional body region focus
 * @param attempt Current retry attempt (internal)
 */
async function generateSoapWithRetry(
  rawText: string,
  language: LanguagePref,
  detail: "concise" | "detailed" = "detailed",
  bodyRegion?: string,
  attempt: number = 1
): Promise<{
  success: boolean;
  soap?: SoapNote;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}> {
  try {
    // Clean and validate transcript
    const cleaned = cleanTranscript(rawText);
    const validation = validateTranscriptLength(cleaned);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Get prompts based on language
    const systemPrompt = getSoapSystemPrompt(language);
    const userPrompt = createSoapUserPrompt(language, {
      rawText: cleaned,
      detail,
      bodyRegion,
    });

    // Generate SOAP note with Azure OpenAI
    const result = await generateObject({
      model: getAzureModel(),
      schema: SoapSchema,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: parseInt(process.env.LLM_MAX_OUTPUT_TOKENS || "1024", 10),
    });

    // Validate generated SOAP
    const soapValidation = SoapSchema.safeParse(result.object);

    if (!soapValidation.success) {
      throw new Error(
        "Validation SOAP échouée: " + soapValidation.error.errors[0].message
      );
    }

    // Estimate tokens (actual usage from result.usage if available)
    const tokensIn = result.usage?.promptTokens || estimateTokenCount(systemPrompt + userPrompt);
    const tokensOut = result.usage?.completionTokens || estimateTokenCount(JSON.stringify(result.object));

    return {
      success: true,
      soap: soapValidation.data,
      tokensIn,
      tokensOut,
    };
  } catch (error) {
    console.error(`[generateSoapWithRetry] Attempt ${attempt} failed:`, error);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`[generateSoapWithRetry] Retrying in ${RETRY_DELAYS[attempt - 1]}ms...`);
      await sleep(RETRY_DELAYS[attempt - 1]);
      return generateSoapWithRetry(rawText, language, detail, bodyRegion, attempt + 1);
    }

    // All retries exhausted
    return {
      success: false,
      error:
        error instanceof Error
          ? `Génération SOAP échouée après ${MAX_RETRIES} tentatives: ${error.message}`
          : "Erreur lors de la génération de la note SOAP.",
    };
  }
}

/**
 * Generates a SOAP note from transcript (main entry point)
 * @param visitId Visit UUID
 * @param rawText Raw transcript or manual input
 * @param options Generation options
 */
export async function generateSoapNote(
  visitId: string,
  rawText: string,
  options: {
    language?: LanguagePref;
    detail?: "concise" | "detailed";
    bodyRegion?: string;
    saveTranscript?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data?: Note;
  error?: string;
}> {
  try {
    const { language = "de", detail = "detailed", bodyRegion, saveTranscript: shouldSaveTranscript = false } = options;

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify visit ownership
    const { data: visit } = await supabase
      .from("visits")
      .select("id, patient_id, status")
      .eq("id", visitId)
      .eq("provider_id", profileId)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    // Check for existing transcript to avoid regeneration (idempotency)
    const transcriptHash = hashTranscript(rawText);
    const { data: existingTranscript } = await supabase
      .from("transcripts")
      .select("text")
      .eq("visit_id", visitId)
      .limit(1)
      .single();

    if (existingTranscript && hashTranscript(existingTranscript.text) === transcriptHash) {
      // Check if SOAP already exists for this transcript
      const { data: existingNote } = await supabase
        .from("notes")
        .select("*")
        .eq("visit_id", visitId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (existingNote) {
        console.log("[generateSoapNote] Idempotent: returning existing note");
        return {
          success: true,
          data: existingNote,
        };
      }
    }

    // Save transcript if requested
    if (shouldSaveTranscript) {
      const transcriptResult = await saveTranscript(visitId, cleanTranscript(rawText), null, language);
      if (!transcriptResult.success) {
        return {
          success: false,
          error: transcriptResult.error,
        };
      }
    }

    // Update visit status to processing
    await supabase
      .from("visits")
      .update({ status: "processing" })
      .eq("id", visitId);

    // Generate SOAP note
    const soapResult = await generateSoapWithRetry(rawText, language, detail, bodyRegion);

    if (!soapResult.success || !soapResult.soap) {
      // Update visit status to failed
      await supabase
        .from("visits")
        .update({ status: "failed" })
        .eq("id", visitId);

      return {
        success: false,
        error: soapResult.error || "Génération SOAP échouée.",
      };
    }

    // Get current max version for this visit
    const { data: existingNotes } = await supabase
      .from("notes")
      .select("version")
      .eq("visit_id", visitId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingNotes && existingNotes.length > 0 ? existingNotes[0].version + 1 : 1;

    // Save SOAP note
    const noteInsert: NoteInsert = {
      visit_id: visitId,
      soap: soapResult.soap,
      model: `azure:${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini-eu"}`,
      version: nextVersion,
      is_final: false,
    };

    const { data: note, error: noteError } = await supabase
      .from("notes")
      .insert(noteInsert)
      .select()
      .single();

    if (noteError || !note) {
      console.error("[generateSoapNote] Failed to save note:", noteError);
      return {
        success: false,
        error: "Erreur lors de la sauvegarde de la note.",
      };
    }

    // Save usage metrics
    const metricsData = createUsageMetrics({
      visitId,
      llmTokensIn: soapResult.tokensIn || 0,
      llmTokensOut: soapResult.tokensOut || 0,
      llmModel: noteInsert.model,
    });

    await supabase.from("usage_metrics").insert(metricsData);

    // Update visit status to completed
    await supabase
      .from("visits")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", visitId);

    revalidatePath(`/dashboard/patients/${visit.patient_id}/visits/${visitId}`);

    return {
      success: true,
      data: note,
    };
  } catch (error) {
    console.error("[generateSoapNote] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}

/**
 * Updates a SOAP note (manual edits)
 * @param noteId Note UUID
 * @param soap Updated SOAP content
 */
export async function updateSoapNote(
  noteId: string,
  soap: SoapNote
): Promise<{
  success: boolean;
  data?: Note;
  error?: string;
}> {
  try {
    // Validate SOAP
    const validation = SoapSchema.safeParse(soap);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify ownership via visit
    const { data: existing } = await supabase
      .from("notes")
      .select("visit_id, visits!inner(provider_id, patient_id)")
      .eq("id", noteId)
      .single();

    if (!existing || (existing.visits as any).provider_id !== profileId) {
      return {
        success: false,
        error: "Note introuvable ou accès refusé.",
      };
    }

    const noteUpdate: NoteUpdate = {
      soap: validation.data,
    };

    const { data, error } = await supabase
      .from("notes")
      .update(noteUpdate)
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("[updateSoapNote] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la mise à jour de la note.",
      };
    }

    revalidatePath(`/dashboard/patients/${(existing.visits as any).patient_id}/visits/${existing.visit_id}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[updateSoapNote] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}

/**
 * Marks a SOAP note as final
 * @param noteId Note UUID
 */
export async function markNoteAsFinal(noteId: string): Promise<{
  success: boolean;
  data?: Note;
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("notes")
      .select("visit_id, visits!inner(provider_id, patient_id)")
      .eq("id", noteId)
      .single();

    if (!existing || (existing.visits as any).provider_id !== profileId) {
      return {
        success: false,
        error: "Note introuvable ou accès refusé.",
      };
    }

    const { data, error } = await supabase
      .from("notes")
      .update({ is_final: true })
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("[markNoteAsFinal] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la finalisation de la note.",
      };
    }

    revalidatePath(`/dashboard/patients/${(existing.visits as any).patient_id}/visits/${existing.visit_id}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[markNoteAsFinal] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}

/**
 * Regenerates SOAP note (creates new version)
 * @param visitId Visit UUID
 * @param rawText Optional new transcript (if not provided, uses existing)
 * @param options Generation options
 */
export async function regenerateSoapNote(
  visitId: string,
  rawText?: string,
  options: {
    language?: LanguagePref;
    detail?: "concise" | "detailed";
    bodyRegion?: string;
  } = {}
): Promise<{
  success: boolean;
  data?: Note;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // If no new text provided, get existing transcript
    let textToUse = rawText;

    if (!textToUse) {
      const { data: transcript } = await supabase
        .from("transcripts")
        .select("text")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!transcript) {
        return {
          success: false,
          error: "Aucun transcript trouvé pour cette visite.",
        };
      }

      textToUse = transcript.text;
    }

    // Generate new SOAP (will auto-increment version)
    return await generateSoapNote(visitId, textToUse, options);
  } catch (error) {
    console.error("[regenerateSoapNote] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}
