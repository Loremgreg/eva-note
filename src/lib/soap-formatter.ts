// SOAP note formatting utilities for copy/paste and export
// Based on PRD section 5: SOAP Note Editor requirements

import type { SoapNote } from "./database.types";

/**
 * Formats a SOAP note for copy/paste with proper German section headers
 * @param soap SOAP note object
 * @param options Formatting options
 * @returns Formatted text ready for copy/paste (UTF-8)
 */
export function formatSoapForCopy(
  soap: SoapNote,
  options: {
    includeHeaders?: boolean;
    includeSeparators?: boolean;
    language?: "de" | "fr";
  } = {}
): string {
  const {
    includeHeaders = true,
    includeSeparators = true,
    language = "de",
  } = options;

  const separator = includeSeparators ? "\n" + "─".repeat(60) + "\n" : "\n";

  const headers =
    language === "de"
      ? {
          subjective: "SUBJEKTIV",
          objective: "OBJEKTIV",
          assessment: "ASSESSMENT",
          plan: "PLAN",
        }
      : {
          subjective: "SUBJECTIF",
          objective: "OBJECTIF",
          assessment: "ÉVALUATION",
          plan: "PLAN",
        };

  const sections: string[] = [];

  if (includeHeaders) {
    // SUBJECTIVE
    sections.push(`${headers.subjective}:`);
    sections.push(soap.subjective);
    sections.push(separator);

    // OBJECTIVE
    sections.push(`${headers.objective}:`);
    sections.push(soap.objective);
    sections.push(separator);

    // ASSESSMENT
    sections.push(`${headers.assessment}:`);
    sections.push(soap.assessment);
    sections.push(separator);

    // PLAN
    sections.push(`${headers.plan}:`);
    sections.push(soap.plan);
  } else {
    // Without headers (plain text)
    sections.push(soap.subjective);
    sections.push(separator);
    sections.push(soap.objective);
    sections.push(separator);
    sections.push(soap.assessment);
    sections.push(separator);
    sections.push(soap.plan);
  }

  return sections.join("\n").trim();
}

/**
 * Formats SOAP note as structured JSON (for API/export)
 * @param soap SOAP note object
 * @returns JSON string
 */
export function formatSoapAsJson(soap: SoapNote): string {
  return JSON.stringify(soap, null, 2);
}

/**
 * Formats SOAP note with metadata (model, version, timestamp)
 * @param soap SOAP note object
 * @param metadata Note metadata
 * @returns Formatted text with metadata header
 */
export function formatSoapWithMetadata(
  soap: SoapNote,
  metadata: {
    model: string;
    version: number;
    createdAt: string;
    patientName?: string;
    visitDate?: string;
  }
): string {
  const metadataHeader = [
    `─────────────────────────────────────────────────────────────`,
    `EVA Note - SOAP Dokumentation`,
    metadata.patientName ? `Patient: ${metadata.patientName}` : null,
    metadata.visitDate ? `Datum: ${metadata.visitDate}` : null,
    `Generiert: ${new Date(metadata.createdAt).toLocaleString("de-DE")}`,
    `Modell: ${metadata.model} (v${metadata.version})`,
    `─────────────────────────────────────────────────────────────`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const formattedSoap = formatSoapForCopy(soap, {
    includeHeaders: true,
    includeSeparators: true,
  });

  return `${metadataHeader}\n${formattedSoap}`;
}

/**
 * Formats SOAP note as Markdown
 * @param soap SOAP note object
 * @param language Language for headers
 * @returns Markdown formatted text
 */
export function formatSoapAsMarkdown(
  soap: SoapNote,
  language: "de" | "fr" = "de"
): string {
  const headers =
    language === "de"
      ? {
          subjective: "Subjektiv",
          objective: "Objektiv",
          assessment: "Assessment",
          plan: "Plan",
        }
      : {
          subjective: "Subjectif",
          objective: "Objectif",
          assessment: "Évaluation",
          plan: "Plan",
        };

  return `## ${headers.subjective}

${soap.subjective}

## ${headers.objective}

${soap.objective}

## ${headers.assessment}

${soap.assessment}

## ${headers.plan}

${soap.plan}
`;
}

/**
 * Estimates character count for each SOAP section
 * @param soap SOAP note object
 * @returns Character counts per section
 */
export function getSoapSectionLengths(soap: SoapNote): {
  subjective: number;
  objective: number;
  assessment: number;
  plan: number;
  total: number;
} {
  return {
    subjective: soap.subjective.length,
    objective: soap.objective.length,
    assessment: soap.assessment.length,
    plan: soap.plan.length,
    total:
      soap.subjective.length +
      soap.objective.length +
      soap.assessment.length +
      soap.plan.length,
  };
}

/**
 * Validates that all SOAP sections have content
 * @param soap SOAP note object
 * @returns Validation result
 */
export function validateSoapCompleteness(soap: SoapNote): {
  complete: boolean;
  missingSections: string[];
} {
  const missingSections: string[] = [];

  if (!soap.subjective || soap.subjective.trim() === "" || soap.subjective === "N/A") {
    missingSections.push("subjective");
  }
  if (!soap.objective || soap.objective.trim() === "" || soap.objective === "N/A") {
    missingSections.push("objective");
  }
  if (!soap.assessment || soap.assessment.trim() === "" || soap.assessment === "N/A") {
    missingSections.push("assessment");
  }
  if (!soap.plan || soap.plan.trim() === "" || soap.plan === "N/A") {
    missingSections.push("plan");
  }

  return {
    complete: missingSections.length === 0,
    missingSections,
  };
}

/**
 * Truncates SOAP sections to maximum lengths (for previews)
 * @param soap SOAP note object
 * @param maxLength Max length per section
 * @returns Truncated SOAP note
 */
export function truncateSoap(
  soap: SoapNote,
  maxLength: number = 200
): SoapNote {
  const truncate = (text: string) =>
    text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;

  return {
    subjective: truncate(soap.subjective),
    objective: truncate(soap.objective),
    assessment: truncate(soap.assessment),
    plan: truncate(soap.plan),
  };
}
