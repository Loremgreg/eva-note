// Auto-generated TypeScript types for Supabase schema
// Based on: supabase/migrations/20250120000000_initial_schema.sql
// NOTE: Run `supabase gen types typescript` to regenerate after schema changes

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VisitStatus = "draft" | "recording" | "processing" | "completed" | "failed";
export type LanguagePref = "de" | "fr" | "auto";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string | null;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email?: string | null;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string | null;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          owner_id: string;
          first_name: string;
          last_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          first_name: string;
          last_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          first_name?: string;
          last_name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      visits: {
        Row: {
          id: string;
          patient_id: string;
          provider_id: string;
          status: VisitStatus;
          language_pref: LanguagePref;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          provider_id: string;
          status?: VisitStatus;
          language_pref?: LanguagePref;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          provider_id?: string;
          status?: VisitStatus;
          language_pref?: LanguagePref;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transcripts: {
        Row: {
          id: string;
          visit_id: string;
          text: string;
          raw_json: Json | null;
          language: string | null;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          text: string;
          raw_json?: Json | null;
          language?: string | null;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          text?: string;
          raw_json?: Json | null;
          language?: string | null;
          confidence?: number | null;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          visit_id: string;
          soap: {
            subjective: string;
            objective: string;
            assessment: string;
            plan: string;
          };
          model: string;
          version: number;
          is_final: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          soap: {
            subjective: string;
            objective: string;
            assessment: string;
            plan: string;
          };
          model: string;
          version?: number;
          is_final?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          soap?: {
            subjective: string;
            objective: string;
            assessment: string;
            plan: string;
          };
          model?: string;
          version?: number;
          is_final?: boolean;
          created_at?: string;
        };
      };
      usage_metrics: {
        Row: {
          id: string;
          visit_id: string;
          stt_seconds: number;
          stt_cost_cents: number;
          stt_model: string | null;
          llm_tokens_in: number;
          llm_tokens_out: number;
          llm_cost_cents: number;
          llm_model: string | null;
          total_cost_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          stt_seconds?: number;
          stt_cost_cents?: number;
          stt_model?: string | null;
          llm_tokens_in?: number;
          llm_tokens_out?: number;
          llm_cost_cents?: number;
          llm_model?: string | null;
          // total_cost_cents is generated, cannot be inserted
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          stt_seconds?: number;
          stt_cost_cents?: number;
          stt_model?: string | null;
          llm_tokens_in?: number;
          llm_tokens_out?: number;
          llm_cost_cents?: number;
          llm_model?: string | null;
          // total_cost_cents is generated, cannot be updated
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      monthly_usage: {
        Row: {
          month: string | null;
          visits: number | null;
          total_stt_seconds: number | null;
          total_cost_eur: number | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      visit_status: VisitStatus;
      language_pref: LanguagePref;
    };
  };
}

// Helper types for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Visit = Database["public"]["Tables"]["visits"]["Row"];
export type Transcript = Database["public"]["Tables"]["transcripts"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type UsageMetric = Database["public"]["Tables"]["usage_metrics"]["Row"];
export type MonthlyUsage = Database["public"]["Views"]["monthly_usage"]["Row"];

// Insert types
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type PatientInsert = Database["public"]["Tables"]["patients"]["Insert"];
export type VisitInsert = Database["public"]["Tables"]["visits"]["Insert"];
export type TranscriptInsert = Database["public"]["Tables"]["transcripts"]["Insert"];
export type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
export type UsageMetricInsert = Database["public"]["Tables"]["usage_metrics"]["Insert"];

// Update types
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type PatientUpdate = Database["public"]["Tables"]["patients"]["Update"];
export type VisitUpdate = Database["public"]["Tables"]["visits"]["Update"];
export type TranscriptUpdate = Database["public"]["Tables"]["transcripts"]["Update"];
export type NoteUpdate = Database["public"]["Tables"]["notes"]["Update"];
export type UsageMetricUpdate = Database["public"]["Tables"]["usage_metrics"]["Update"];

// SOAP note structure type
export type SoapNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};
