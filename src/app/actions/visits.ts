"use server";

// Server Actions for Visit management
// Based on PRD section 3: Visit flow (draft → recording → processing → completed)

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  VisitSchema,
  VisitStatusSchema,
  type VisitFormData,
} from "@/lib/schemas";
import type {
  Visit,
  VisitInsert,
  VisitUpdate,
  VisitStatus,
  Transcript,
  Note,
} from "@/lib/database.types";

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
 * Creates a new visit for a patient
 * @param formData Visit form data (patient_id, language_pref)
 * @returns Created visit or error
 */
export async function createVisit(formData: VisitFormData): Promise<{
  success: boolean;
  data?: Visit;
  error?: string;
}> {
  try {
    // Validate input
    const validation = VisitSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify patient ownership
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", validation.data.patient_id)
      .eq("owner_id", profileId)
      .single();

    if (!patient) {
      return {
        success: false,
        error: "Patient introuvable ou accès refusé.",
      };
    }

    const visitInsert: VisitInsert = {
      patient_id: validation.data.patient_id,
      provider_id: profileId,
      status: "draft",
      language_pref: validation.data.language_pref,
    };

    const { data, error } = await supabase
      .from("visits")
      .insert(visitInsert)
      .select()
      .single();

    if (error) {
      console.error("[createVisit] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la création de la visite.",
      };
    }

    revalidatePath(`/dashboard/patients/${validation.data.patient_id}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[createVisit] Unexpected error:", error);
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
 * Gets all visits for a patient
 * @param patientId Patient UUID
 * @returns List of visits or error
 */
export async function getVisitsByPatient(patientId: string): Promise<{
  success: boolean;
  data?: Visit[];
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify patient ownership
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("owner_id", profileId)
      .single();

    if (!patient) {
      return {
        success: false,
        error: "Patient introuvable ou accès refusé.",
      };
    }

    const { data, error } = await supabase
      .from("visits")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getVisitsByPatient] Database error:", error);
      return {
        success: false,
        error: "Erreur lors du chargement des visites.",
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("[getVisitsByPatient] Unexpected error:", error);
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
 * Gets a single visit by ID with related data (transcript, note)
 * @param visitId Visit UUID
 * @returns Visit with transcript and note or error
 */
export async function getVisit(visitId: string): Promise<{
  success: boolean;
  data?: Visit & { transcript?: Transcript; note?: Note };
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Get visit with provider verification
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("*")
      .eq("id", visitId)
      .eq("provider_id", profileId)
      .single();

    if (visitError || !visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    // Get transcript if exists
    const { data: transcript } = await supabase
      .from("transcripts")
      .select("*")
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get latest note if exists
    const { data: note } = await supabase
      .from("notes")
      .select("*")
      .eq("visit_id", visitId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    return {
      success: true,
      data: {
        ...visit,
        transcript: transcript || undefined,
        note: note || undefined,
      },
    };
  } catch (error) {
    console.error("[getVisit] Unexpected error:", error);
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
 * Updates visit status
 * @param visitId Visit UUID
 * @param status New status
 * @returns Updated visit or error
 */
export async function updateVisitStatus(
  visitId: string,
  status: VisitStatus
): Promise<{
  success: boolean;
  data?: Visit;
  error?: string;
}> {
  try {
    // Validate status
    const validation = VisitStatusSchema.safeParse(status);
    if (!validation.success) {
      return {
        success: false,
        error: "Statut invalide.",
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("visits")
      .select("id, status")
      .eq("id", visitId)
      .eq("provider_id", profileId)
      .single();

    if (!existing) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    const visitUpdate: VisitUpdate = {
      status: validation.data,
    };

    // Set timestamps based on status transitions
    if (validation.data === "recording" && !existing.status) {
      visitUpdate.started_at = new Date().toISOString();
    } else if (
      validation.data === "completed" &&
      existing.status !== "completed"
    ) {
      visitUpdate.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("visits")
      .update(visitUpdate)
      .eq("id", visitId)
      .select()
      .single();

    if (error) {
      console.error("[updateVisitStatus] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la mise à jour du statut.",
      };
    }

    revalidatePath(`/dashboard/patients/${data.patient_id}/visits/${visitId}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[updateVisitStatus] Unexpected error:", error);
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
 * Deletes a visit (cascade deletes transcripts, notes, metrics)
 * @param visitId Visit UUID
 * @returns Success status or error
 */
export async function deleteVisit(visitId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Get visit to verify ownership and patient ID for revalidation
    const { data: visit } = await supabase
      .from("visits")
      .select("patient_id")
      .eq("id", visitId)
      .eq("provider_id", profileId)
      .single();

    if (!visit) {
      return {
        success: false,
        error: "Visite introuvable ou accès refusé.",
      };
    }

    const { error } = await supabase.from("visits").delete().eq("id", visitId);

    if (error) {
      console.error("[deleteVisit] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la suppression de la visite.",
      };
    }

    revalidatePath(`/dashboard/patients/${visit.patient_id}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[deleteVisit] Unexpected error:", error);
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
 * Gets recent visits across all patients (for dashboard)
 * @param limit Maximum number of visits to return
 * @returns List of recent visits or error
 */
export async function getRecentVisits(limit: number = 10): Promise<{
  success: boolean;
  data?: Array<Visit & { patient?: { first_name: string; last_name: string } }>;
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("visits")
      .select(
        `
        *,
        patients:patient_id (first_name, last_name)
      `
      )
      .eq("provider_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getRecentVisits] Database error:", error);
      return {
        success: false,
        error: "Erreur lors du chargement des visites récentes.",
      };
    }

    return {
      success: true,
      data: data as any, // Type assertion for joined data
    };
  } catch (error) {
    console.error("[getRecentVisits] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}
