// Azure OpenAI client with EU region enforcement (GDPR compliance)
// Based on PRD section 4: Security & GDPR

import { createAzure } from "@ai-sdk/azure";

// Valid EU regions for Azure OpenAI (GDPR compliant)
const EU_REGIONS = [
  "westeurope",
  "northeurope",
  "francecentral",
  "germanywestcentral",
  "switzerlandnorth",
  "norwayeast",
  "swedencentral",
  "polandcentral",
] as const;

type EURegion = (typeof EU_REGIONS)[number];

/**
 * Validates that the Azure OpenAI region is EU-compliant
 * @throws Error if region is not in EU or missing
 */
function validateEURegion(region: string | undefined): asserts region is EURegion {
  if (!region) {
    throw new Error(
      "AZURE_OPENAI_REGION environment variable is required. " +
        "Application will not start without EU region configured."
    );
  }

  const normalizedRegion = region.toLowerCase().trim();

  if (!EU_REGIONS.includes(normalizedRegion as EURegion)) {
    throw new Error(
      `AZURE_OPENAI_REGION "${region}" is not a valid EU region. ` +
        `Valid EU regions: ${EU_REGIONS.join(", ")}. ` +
        "GDPR compliance requires EU-only data processing."
    );
  }
}

/**
 * Validates required environment variables
 * @throws Error if any required variable is missing
 */
function validateEnvironment() {
  const requiredVars = {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_REGION: process.env.AZURE_OPENAI_REGION,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Please configure Azure OpenAI settings in .env file."
    );
  }

  // Validate EU region
  validateEURegion(requiredVars.AZURE_OPENAI_REGION);
}

// Validate on module load (fail fast if misconfigured)
validateEnvironment();

/**
 * Azure OpenAI client configured for EU region
 * Singleton instance to reuse connection
 */
export const azureOpenAI = createAzure({
  resourceName: process.env.AZURE_OPENAI_ENDPOINT!.split("//")[1].split(".")[0],
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
});

/**
 * Gets the configured model deployment name
 */
export function getModelDeployment(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini-eu";
}

/**
 * Gets the maximum output tokens from environment or default
 */
export function getMaxOutputTokens(): number {
  const envValue = process.env.LLM_MAX_OUTPUT_TOKENS;
  return envValue ? parseInt(envValue, 10) : 1024;
}

/**
 * Gets the API version
 */
export function getApiVersion(): string {
  return process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";
}

/**
 * Gets the configured region (validated as EU)
 */
export function getRegion(): EURegion {
  const region = process.env.AZURE_OPENAI_REGION!;
  validateEURegion(region);
  return region.toLowerCase() as EURegion;
}

/**
 * Configuration summary for logging (without sensitive data)
 */
export function getAzureConfigSummary() {
  return {
    region: getRegion(),
    deployment: getModelDeployment(),
    maxTokens: getMaxOutputTokens(),
    apiVersion: getApiVersion(),
  };
}

/**
 * Type-safe model reference for use with Vercel AI SDK
 */
export function getAzureModel() {
  return azureOpenAI(getModelDeployment());
}
