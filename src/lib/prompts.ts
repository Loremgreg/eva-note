// SOAP generation prompts for Azure OpenAI (German language)
// Based on PRD section 7: Prompt Engineering

/**
 * System prompt for SOAP note generation in German
 * Used with Azure OpenAI to generate structured clinical documentation
 */
export const SOAP_SYSTEM_DE = `Du bist ein klinischer Assistent für Physiotherapie auf Deutsch.
Erzeuge eine **detaillierte SOAP-Notiz** aus Transkript oder Freitext.

REGELN:
- **Sprache**: Deutsch.
- **Nichts erfinden**: Fehlende Information = "N/A".
- **Struktur & Format**: Ausgabe ausschließlich als JSON {subjective, objective, assessment, plan}.
- **Stil**: klinisch, präzise, kurze Sätze, Stichpunkte erlaubt.
- **Ziele**: nach Möglichkeit SMART (konkret, messbar, terminierbar).

ANFORDERUNGEN:
- SUBJEKTIV: Hauptbeschwerden, Schmerzskala (NRS/VAS 0–10), Verlauf, Red Flags (falls erwähnt).
- OBJEKTIV: Messwerte (ROM in Grad °), Kraftgrade (0–5), relevante Tests (z. B. Lasègue, Hawkins-Kennedy), Beobachtungen.
- ASSESSMENT: Klinische Einschätzung, Hypothesen, Irritabilität (niedrig/mittel/hoch), Fortschritt seit letzter Sitzung (falls vorhanden).
- PLAN: Interventionen (mit Dosierung/Frequenz), HEP, Ziele nach SMART, nächste Schritte/Termine.

WICHTIG:
- Wenn eine Information fehlt, schreibe "N/A" statt etwas zu erfinden.
- Die Ausgabe muss valides JSON sein mit genau diesen 4 Feldern: subjective, objective, assessment, plan.
- Bleibe objektiv und klinisch. Keine persönlichen Meinungen oder Spekulationen.`;

/**
 * User prompt template for SOAP note generation
 * Accepts transcript/manual input and optional parameters
 */
export function createSoapUserPromptDE(params: {
  rawText: string;
  detail?: "concise" | "detailed";
  bodyRegion?: string;
}): string {
  const { rawText, detail = "detailed", bodyRegion } = params;

  const detailInstruction =
    detail === "detailed"
      ? "hoch (bitte Messwerte/Tests/Scores aufnehmen)"
      : "mittel (nur Kernaussagen)";

  const regionContext = bodyRegion ? `- Fokusregion: ${bodyRegion}` : "";

  return `KONTEXT:
- Detailtiefe: ${detailInstruction}
${regionContext}

TRANSKRIPTION/NOTIZEN:
"""
${rawText}
"""

HINWEIS:
- System-Regeln gelten (Deutsch, nichts erfinden → "N/A", Ausgabe nur JSON).
- Die Ausgabe muss ein valides JSON-Objekt sein: {"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}`;
}

/**
 * System prompt for SOAP note generation in French (future i18n)
 * Currently not used in MVP but prepared for post-MVP internationalization
 */
export const SOAP_SYSTEM_FR = `Tu es un assistant clinique pour la kinésithérapie en français.
Génère une **note SOAP détaillée** à partir d'une transcription ou d'un texte libre.

RÈGLES :
- **Langue** : Français.
- **Ne rien inventer** : Information manquante = "N/D" (non disponible).
- **Structure & Format** : Sortie uniquement en JSON {subjective, objective, assessment, plan}.
- **Style** : clinique, précis, phrases courtes, puces autorisées.
- **Objectifs** : si possible SMART (spécifiques, mesurables, atteignables, réalistes, temporellement définis).

EXIGENCES :
- SUBJECTIF : Plaintes principales, échelle de douleur (EVA/EN 0–10), évolution, drapeaux rouges (si mentionnés).
- OBJECTIF : Mesures (amplitude articulaire en degrés °), force musculaire (0–5), tests pertinents (ex. Lasègue, Hawkins-Kennedy), observations.
- ÉVALUATION : Appréciation clinique, hypothèses, irritabilité (faible/moyenne/élevée), progrès depuis la dernière séance (si disponible).
- PLAN : Interventions (avec dosage/fréquence), programme d'exercices à domicile (PED), objectifs SMART, prochaines étapes/rendez-vous.

IMPORTANT :
- Si une information manque, écrivez "N/D" au lieu d'inventer.
- La sortie doit être un JSON valide avec exactement ces 4 champs : subjective, objective, assessment, plan.
- Restez objectif et clinique. Pas d'opinions personnelles ou de spéculations.`;

/**
 * User prompt template for French (future i18n)
 */
export function createSoapUserPromptFR(params: {
  rawText: string;
  detail?: "concise" | "detailed";
  bodyRegion?: string;
}): string {
  const { rawText, detail = "detailed", bodyRegion } = params;

  const detailInstruction =
    detail === "detailed"
      ? "élevé (inclure les mesures/tests/scores)"
      : "moyen (uniquement les points essentiels)";

  const regionContext = bodyRegion ? `- Région ciblée : ${bodyRegion}` : "";

  return `CONTEXTE :
- Niveau de détail : ${detailInstruction}
${regionContext}

TRANSCRIPTION/NOTES :
"""
${rawText}
"""

REMARQUE :
- Les règles système s'appliquent (Français, ne rien inventer → "N/D", sortie JSON uniquement).
- La sortie doit être un objet JSON valide : {"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}`;
}

/**
 * Selects the appropriate system prompt based on language preference
 */
export function getSoapSystemPrompt(language: "de" | "fr" | "auto"): string {
  if (language === "fr") return SOAP_SYSTEM_FR;
  // Default to German for MVP (auto defaults to DE)
  return SOAP_SYSTEM_DE;
}

/**
 * Creates a user prompt based on language preference
 */
export function createSoapUserPrompt(
  language: "de" | "fr" | "auto",
  params: {
    rawText: string;
    detail?: "concise" | "detailed";
    bodyRegion?: string;
  }
): string {
  if (language === "fr") return createSoapUserPromptFR(params);
  // Default to German for MVP (auto defaults to DE)
  return createSoapUserPromptDE(params);
}
