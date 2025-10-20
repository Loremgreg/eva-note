// Transcript cleaning and validation utilities
// Based on PRD section 3: Resilience & Error Handling

/**
 * Minimum acceptable transcript length (characters)
 */
export const MIN_TRANSCRIPT_LENGTH = 20;

/**
 * Maximum transcript length (characters)
 */
export const MAX_TRANSCRIPT_LENGTH = 100000;

/**
 * Common filler words and hesitations in German to remove
 */
const GERMAN_FILLERS = [
  "ähm",
  "äh",
  "ehm",
  "eh",
  "hm",
  "hmm",
  "uh",
  "uhm",
  "also",
  "ja also",
  "naja",
];

/**
 * Cleans a transcript by removing hesitations, extra whitespace, and metadata
 * @param text Raw transcript text
 * @returns Cleaned transcript text
 */
export function cleanTranscript(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  let cleaned = text;

  // Remove common German filler words (case-insensitive)
  GERMAN_FILLERS.forEach((filler) => {
    const regex = new RegExp(`\\b${filler}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  });

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  // Remove duplicate consecutive sentences (simple heuristic)
  cleaned = cleaned.replace(/([.!?])\s*\1+/g, "$1");

  return cleaned;
}

/**
 * Validates transcript length and content
 * @param text Transcript text to validate
 * @returns Validation result with success flag and error message if any
 */
export function validateTranscriptLength(text: string): {
  valid: boolean;
  error?: string;
  length: number;
} {
  const trimmed = text.trim();
  const length = trimmed.length;

  if (length === 0) {
    return {
      valid: false,
      error: "Der Transcript ist leer",
      length: 0,
    };
  }

  if (length < MIN_TRANSCRIPT_LENGTH) {
    return {
      valid: false,
      error: `Der Transcript ist zu kurz (${length} Zeichen, mindestens ${MIN_TRANSCRIPT_LENGTH} erforderlich)`,
      length,
    };
  }

  if (length > MAX_TRANSCRIPT_LENGTH) {
    return {
      valid: false,
      error: `Der Transcript ist zu lang (${length} Zeichen, maximal ${MAX_TRANSCRIPT_LENGTH} erlaubt)`,
      length,
    };
  }

  return {
    valid: true,
    length,
  };
}

/**
 * Checks if a transcript has meaningful content (not just whitespace/punctuation)
 * @param text Transcript text
 * @returns True if transcript has meaningful content
 */
export function hasMeaningfulContent(text: string): boolean {
  // Remove punctuation and whitespace
  const contentOnly = text.replace(/[^\w\s]/g, "").trim();
  return contentOnly.length >= MIN_TRANSCRIPT_LENGTH;
}

/**
 * Estimates word count for transcript
 * @param text Transcript text
 * @returns Approximate word count
 */
export function estimateWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Calculates a simple hash of transcript content for idempotency checks
 * @param text Transcript text
 * @returns Simple hash string
 */
export function hashTranscript(text: string): string {
  const cleaned = cleanTranscript(text);
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Formats transcript for display with proper line breaks
 * @param text Transcript text
 * @returns Formatted transcript with line breaks
 */
export function formatTranscriptForDisplay(text: string): string {
  // Add line breaks after sentence-ending punctuation
  return text
    .replace(/([.!?])\s+/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Truncates transcript to a maximum length (for previews)
 * @param text Transcript text
 * @param maxLength Maximum length (default 200)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateTranscript(
  text: string,
  maxLength: number = 200
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + "...";
}

/**
 * Extracts metadata from Deepgram raw JSON
 * @param rawJson Deepgram response JSON
 * @returns Extracted metadata
 */
export function extractDeepgramMetadata(rawJson: any): {
  language?: string;
  confidence?: number;
  duration?: number;
} {
  if (!rawJson || typeof rawJson !== "object") {
    return {};
  }

  return {
    language: rawJson.metadata?.model_info?.name || undefined,
    confidence:
      rawJson.channel?.alternatives?.[0]?.confidence || undefined,
    duration: rawJson.metadata?.duration || undefined,
  };
}
