"use server";

// Server Actions for Patient CRUD operations
// Based on PRD section 2: Server Components/Actions pattern

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { PatientSchema, type PatientFormData } from "@/lib/schemas";
import type { Patient, PatientInsert, PatientUpdate } from "@/lib/database.types";

/**
 * Gets the current user's profile ID from Supabase
 * @throws Error if user not authenticated or profile not found
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
    throw new Error(
      "Profil utilisateur introuvable. Veuillez contacter le support."
    );
  }

  return profile.id;
}

/**
 * Creates a new patient
 * @param formData Patient form data (first_name, last_name)
 * @returns Created patient or error
 */
export async function createPatient(formData: PatientFormData): Promise<{
  success: boolean;
  data?: Patient;
  error?: string;
}> {
  try {
    // Validate input
    const validation = PatientSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    const patientInsert: PatientInsert = {
      owner_id: profileId,
      first_name: validation.data.first_name.trim(),
      last_name: validation.data.last_name.trim(),
    };

    const { data, error } = await supabase
      .from("patients")
      .insert(patientInsert)
      .select()
      .single();

    if (error) {
      console.error("[createPatient] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la création du patient. Veuillez réessayer.",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/patients");

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[createPatient] Unexpected error:", error);
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
 * Gets all patients for the current user
 * @returns List of patients or error
 */
export async function getPatients(): Promise<{
  success: boolean;
  data?: Patient[];
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("owner_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getPatients] Database error:", error);
      return {
        success: false,
        error: "Erreur lors du chargement des patients.",
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("[getPatients] Unexpected error:", error);
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
 * Gets a single patient by ID
 * @param patientId Patient UUID
 * @returns Patient data or error
 */
export async function getPatient(patientId: string): Promise<{
  success: boolean;
  data?: Patient;
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .eq("owner_id", profileId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: "Patient introuvable ou accès refusé.",
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[getPatient] Unexpected error:", error);
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
 * Updates a patient
 * @param patientId Patient UUID
 * @param formData Updated patient data
 * @returns Updated patient or error
 */
export async function updatePatient(
  patientId: string,
  formData: PatientFormData
): Promise<{
  success: boolean;
  data?: Patient;
  error?: string;
}> {
  try {
    // Validate input
    const validation = PatientSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("owner_id", profileId)
      .single();

    if (!existing) {
      return {
        success: false,
        error: "Patient introuvable ou accès refusé.",
      };
    }

    const patientUpdate: PatientUpdate = {
      first_name: validation.data.first_name.trim(),
      last_name: validation.data.last_name.trim(),
    };

    const { data, error } = await supabase
      .from("patients")
      .update(patientUpdate)
      .eq("id", patientId)
      .select()
      .single();

    if (error) {
      console.error("[updatePatient] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la mise à jour du patient.",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/patients");
    revalidatePath(`/dashboard/patients/${patientId}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[updatePatient] Unexpected error:", error);
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
 * Deletes a patient (cascade deletes visits, transcripts, notes)
 * @param patientId Patient UUID
 * @returns Success status or error
 */
export async function deletePatient(patientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("owner_id", profileId)
      .single();

    if (!existing) {
      return {
        success: false,
        error: "Patient introuvable ou accès refusé.",
      };
    }

    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", patientId);

    if (error) {
      console.error("[deletePatient] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la suppression du patient.",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/patients");

    return {
      success: true,
    };
  } catch (error) {
    console.error("[deletePatient] Unexpected error:", error);
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
 * Searches patients by name
 * @param query Search query (first or last name)
 * @returns Matching patients or error
 */
export async function searchPatients(query: string): Promise<{
  success: boolean;
  data?: Patient[];
  error?: string;
}> {
  try {
    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: "La recherche doit contenir au moins 2 caractères.",
      };
    }

    const profileId = await getCurrentProfileId();
    const supabase = await createSupabaseServerClient();

    const searchTerm = `%${query.trim()}%`;

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("owner_id", profileId)
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[searchPatients] Database error:", error);
      return {
        success: false,
        error: "Erreur lors de la recherche des patients.",
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("[searchPatients] Unexpected error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue s'est produite.",
    };
  }
}
