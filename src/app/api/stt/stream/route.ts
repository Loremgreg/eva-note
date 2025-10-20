// WebSocket proxy for Deepgram STT streaming
// Based on PRD section 2.2: API Routes - WebSocket proxy

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * WebSocket closure codes
 */
const WS_CLOSE_CODES = {
  INACTIVITY_TIMEOUT: 4000,
  CLIENT_CLOSED: 4001,
  PROXY_ERROR: 4002,
  UNAUTHORIZED: 4003,
} as const;

/**
 * Configuration from environment
 */
const CONFIG = {
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY!,
  DEEPGRAM_MODEL: process.env.DEEPGRAM_MODEL || "nova-3",
  DEEPGRAM_LANGUAGE: process.env.DEEPGRAM_LANGUAGE || "de",
  WS_TIMEOUT_MS: parseInt(process.env.WS_TIMEOUT_MS || "30000", 10),
  WS_HEARTBEAT_INTERVAL_MS: parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || "10000", 10),
  STT_MAX_DURATION_SEC: parseInt(process.env.STT_MAX_DURATION_SEC || "900", 10),
};

/**
 * Validates environment variables
 */
function validateEnvironment() {
  if (!CONFIG.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
}

validateEnvironment();

/**
 * POST handler for WebSocket upgrade
 * Note: Next.js App Router doesn't natively support WebSocket upgrades
 * This is a REST endpoint that would need to be adapted for actual WebSocket
 *
 * For production, consider:
 * 1. Using a separate WebSocket server (e.g., Socket.io, ws)
 * 2. Deploying WebSocket handler separately (e.g., on AWS Lambda with API Gateway WebSocket)
 * 3. Using a real-time service like Pusher or Ably
 *
 * This implementation provides the SERVER ACTIONS for transcript handling
 * The actual WebSocket client-server connection should be implemented separately
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get visit ID from request body
    const body = await request.json();
    const { visitId } = body;

    if (!visitId) {
      return new Response(
        JSON.stringify({ error: "visitId requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return Deepgram configuration for client-side WebSocket connection
    // The client will use this to connect directly to Deepgram
    // NOTE: In production, this should be a server-side proxy to hide API key

    const deepgramWsUrl = `wss://api.deepgram.com/v1/listen?model=${CONFIG.DEEPGRAM_MODEL}&language=${CONFIG.DEEPGRAM_LANGUAGE}&punctuate=true&interim_results=true&encoding=opus&sample_rate=48000`;

    return new Response(
      JSON.stringify({
        success: true,
        config: {
          wsUrl: deepgramWsUrl,
          // DO NOT expose API key in production - this is for MVP demo only
          // apiKey: CONFIG.DEEPGRAM_API_KEY,
          timeout: CONFIG.WS_TIMEOUT_MS,
          maxDuration: CONFIG.STT_MAX_DURATION_SEC,
          visitId,
        },
        warning: "Production implementation requires server-side WebSocket proxy",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[POST /api/stt/stream] Error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur serveur",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * GET handler - returns endpoint information
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: "/api/stt/stream",
      method: "POST",
      description: "Deepgram STT WebSocket proxy configuration",
      requiredFields: ["visitId"],
      config: {
        model: CONFIG.DEEPGRAM_MODEL,
        language: CONFIG.DEEPGRAM_LANGUAGE,
        timeout: CONFIG.WS_TIMEOUT_MS,
        maxDuration: CONFIG.STT_MAX_DURATION_SEC,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
