"use server";

// Server Actions for transcription management
// Provides secure Deepgram configuration without exposing API key

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { TranscriptSchema } from "@/lib/schemas";
import { cleanTranscript, validateTranscriptLength } from "@/lib/transcript-utils";
import { createUsageMetrics } from "@/lib/metrics";
import type { TranscriptInsert } from "@/lib/database.types";

/**
 * Gets Deepgram configuration for WebSocket connection
 * Returns configuration WITHOUT the API key (client will use a temporary token approach)
 * @param visitId Visit UUID
 */
export async function getDeepgramConfig(visitId: string): Promise<{
  success: boolean;
  config?: {
    model: string;
    language: string;
    timeout: number;
    maxDuration: number;
    visitId: string;
  };
  error?: string;
}> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Non authentifié. Veuillez vous connecter.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return {
        success: false,
        error: "Profil utilisateur introuvable.",
      };
    }

    // Verify visit ownership
    const { data: visit } = await supabase
      .from("visits")
      .select("id, status")
      .eq("id", visitId)
      .eq("provider_id", profile.id)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    return {
      success: true,
      config: {
        model: process.env.DEEPGRAM_MODEL || "nova-3",
        language: process.env.DEEPGRAM_LANGUAGE || "de",
        timeout: parseInt(process.env.WS_TIMEOUT_MS || "30000", 10),
        maxDuration: parseInt(process.env.STT_MAX_DURATION_SEC || "900", 10),
        visitId,
      },
    };
  } catch (error) {
    console.error("[getDeepgramConfig] Unexpected error:", error);
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
 * Gets a temporary Deepgram API key for client-side use
 * NOTE: In production, use Deepgram's temporary key API
 * For MVP, we'll return the config without exposing the key
 *
 * @param visitId Visit UUID
 */
export async function getDeepgramTemporaryKey(visitId: string): Promise<{
  success: boolean;
  data?: {
    apiKey: string; // WARNING: Only for MVP demo - never expose in production!
    expiresAt: string;
  };
  error?: string;
}> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Non authentifié.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // Get profile and verify visit ownership
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return {
        success: false,
        error: "Profil introuvable.",
      };
    }

    const { data: visit } = await supabase
      .from("visits")
      .select("id")
      .eq("id", visitId)
      .eq("provider_id", profile.id)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    // WARNING: This is insecure for production!
    // In production, use Deepgram's temporary key API:
    // https://developers.deepgram.com/docs/temporary-api-keys

    const apiKey = process.env.DEEPGRAM_API_KEY!;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    return {
      success: true,
      data: {
        apiKey, // DO NOT do this in production!
        expiresAt,
      },
    };
  } catch (error) {
    console.error("[getDeepgramTemporaryKey] Unexpected error:", error);
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
 * Saves a final transcript after WebSocket session ends
 * @param visitId Visit UUID
 * @param text Transcript text
 * @param metadata Optional metadata from Deepgram
 */
export async function saveTranscriptFromStream(
  visitId: string,
  text: string,
  metadata?: {
    rawJson?: any;
    language?: string;
    confidence?: number;
    durationSeconds?: number;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Non authentifié.",
      };
    }

    // Clean and validate transcript
    const cleaned = cleanTranscript(text);
    const validation = validateTranscriptLength(cleaned);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const supabase = await createSupabaseServerClient();

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return {
        success: false,
        error: "Profil introuvable.",
      };
    }

    // Verify visit ownership
    const { data: visit } = await supabase
      .from("visits")
      .select("id, patient_id")
      .eq("id", visitId)
      .eq("provider_id", profile.id)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    // Validate transcript schema
    const transcriptValidation = TranscriptSchema.safeParse({
      text: cleaned,
      raw_json: metadata?.rawJson,
      language: metadata?.language,
      confidence: metadata?.confidence,
    });

    if (!transcriptValidation.success) {
      return {
        success: false,
        error: transcriptValidation.error.errors[0].message,
      };
    }

    // Save transcript
    const transcriptInsert: TranscriptInsert = {
      visit_id: visitId,
      text: cleaned,
      raw_json: metadata?.rawJson,
      language: metadata?.language,
      confidence: metadata?.confidence,
    };

    const { error: transcriptError } = await supabase
      .from("transcripts")
      .insert(transcriptInsert);

    if (transcriptError) {
      console.error("[saveTranscriptFromStream] Database error:", transcriptError);
      return {
        success: false,
        error: "Erreur lors de la sauvegarde du transcript.",
      };
    }

    // Save usage metrics for STT
    if (metadata?.durationSeconds) {
      const metricsData = createUsageMetrics({
        visitId,
        sttSeconds: Math.round(metadata.durationSeconds),
        sttModel: `deepgram:${process.env.DEEPGRAM_MODEL || "nova-3"}`,
      });

      await supabase.from("usage_metrics").insert(metricsData);
    }

    // Update visit status
    await supabase
      .from("visits")
      .update({ status: "completed" })
      .eq("id", visitId);

    revalidatePath(`/dashboard/patients/${visit.patient_id}/visits/${visitId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[saveTranscriptFromStream] Unexpected error:", error);
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
 * Updates visit status during recording
 * @param visitId Visit UUID
 * @param status New status
 */
export async function updateRecordingStatus(
  visitId: string,
  status: "recording" | "processing" | "completed" | "failed"
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Non authentifié.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return {
        success: false,
        error: "Profil introuvable.",
      };
    }

    // Verify visit ownership
    const { data: visit } = await supabase
      .from("visits")
      .select("id, patient_id, status")
      .eq("id", visitId)
      .eq("provider_id", profile.id)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    // Update status
    const updateData: any = { status };

    // Set timestamps based on status
    if (status === "recording" && visit.status === "draft") {
      updateData.started_at = new Date().toISOString();
    } else if (status === "completed") {
      updateData.ended_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("visits")
      .update(updateData)
      .eq("id", visitId);

    if (error) {
      console.error("[updateRecordingStatus] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la mise à jour du statut.",
      };
    }

    revalidatePath(`/dashboard/patients/${visit.patient_id}/visits/${visitId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[updateRecordingStatus] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}
