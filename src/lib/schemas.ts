// Zod validation schemas for EVA Note MVP
import { z } from "zod";

// =====================================================
// SOAP Note Schema
// =====================================================
export const SoapSchema = z.object({
  subjective: z
    .string()
    .min(1, "Le champ Subjective ne peut pas être vide")
    .max(10000, "Le champ Subjective est trop long (max 10 000 caractères)"),
  objective: z
    .string()
    .min(1, "Le champ Objective ne peut pas être vide")
    .max(10000, "Le champ Objective est trop long (max 10 000 caractères)"),
  assessment: z
    .string()
    .min(1, "Le champ Assessment ne peut pas être vide")
    .max(10000, "Le champ Assessment est trop long (max 10 000 caractères)"),
  plan: z
    .string()
    .min(1, "Le champ Plan ne peut pas être vide")
    .max(10000, "Le champ Plan est trop long (max 10 000 caractères)"),
});

export type SoapFormData = z.infer<typeof SoapSchema>;

// =====================================================
// Patient Schema
// =====================================================
export const PatientSchema = z.object({
  first_name: z
    .string()
    .min(1, "Le prénom est requis")
    .max(100, "Le prénom est trop long (max 100 caractères)")
    .regex(/\S/, "Le prénom ne peut pas être vide"),
  last_name: z
    .string()
    .min(1, "Le nom est requis")
    .max(100, "Le nom est trop long (max 100 caractères)")
    .regex(/\S/, "Le nom ne peut pas être vide"),
});

export type PatientFormData = z.infer<typeof PatientSchema>;

// =====================================================
// Visit Schema
// =====================================================
export const VisitStatusSchema = z.enum([
  "draft",
  "recording",
  "processing",
  "completed",
  "failed",
]);

export const LanguagePrefSchema = z.enum(["de", "fr", "auto"]);

export const VisitSchema = z.object({
  patient_id: z.string().uuid("ID patient invalide"),
  language_pref: LanguagePrefSchema.default("de"),
  status: VisitStatusSchema.default("draft"),
});

export type VisitFormData = z.infer<typeof VisitSchema>;

// =====================================================
// Transcript Schema
// =====================================================
export const TranscriptSchema = z.object({
  text: z
    .string()
    .min(20, "Le transcript est trop court (minimum 20 caractères)")
    .max(100000, "Le transcript est trop long (max 100 000 caractères)"),
  raw_json: z.any().optional(),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type TranscriptFormData = z.infer<typeof TranscriptSchema>;

// =====================================================
// Usage Metrics Schema
// =====================================================
export const UsageMetricsSchema = z.object({
  visit_id: z.string().uuid(),
  stt_seconds: z.number().int().min(0).default(0),
  stt_cost_cents: z.number().int().min(0).default(0),
  stt_model: z.string().optional(),
  llm_tokens_in: z.number().int().min(0).default(0),
  llm_tokens_out: z.number().int().min(0).default(0),
  llm_cost_cents: z.number().int().min(0).default(0),
  llm_model: z.string().optional(),
});

export type UsageMetricsFormData = z.infer<typeof UsageMetricsSchema>;

// =====================================================
// Note Creation/Update Schema
// =====================================================
export const NoteSchema = z.object({
  visit_id: z.string().uuid("ID visite invalide"),
  soap: SoapSchema,
  model: z.string().min(1, "Le modèle est requis"),
  version: z.number().int().min(1).default(1),
  is_final: z.boolean().default(false),
});

export type NoteFormData = z.infer<typeof NoteSchema>;

// =====================================================
// Deepgram WebSocket Message Schemas
// =====================================================
export const DeepgramPartialSchema = z.object({
  type: z.literal("Results"),
  channel: z.object({
    alternatives: z.array(
      z.object({
        transcript: z.string(),
        confidence: z.number().optional(),
      })
    ),
  }),
  is_final: z.boolean(),
});

export const DeepgramFinalSchema = z.object({
  type: z.literal("Results"),
  channel: z.object({
    alternatives: z.array(
      z.object({
        transcript: z.string(),
        confidence: z.number().optional(),
      })
    ),
  }),
  is_final: z.literal(true),
  speech_final: z.boolean().optional(),
});

// =====================================================
// Helper Functions
// =====================================================

/**
 * Validates SOAP note data
 */
export function validateSoapNote(data: unknown) {
  return SoapSchema.safeParse(data);
}

/**
 * Validates patient data
 */
export function validatePatient(data: unknown) {
  return PatientSchema.safeParse(data);
}

/**
 * Validates transcript data
 */
export function validateTranscript(data: unknown) {
  return TranscriptSchema.safeParse(data);
}

/**
 * Validates visit data
 */
export function validateVisit(data: unknown) {
  return VisitSchema.safeParse(data);
}

/**
 * Validates usage metrics data
 */
export function validateUsageMetrics(data: unknown) {
  return UsageMetricsSchema.safeParse(data);
}
