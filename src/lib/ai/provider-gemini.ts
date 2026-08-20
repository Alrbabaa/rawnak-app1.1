/**
 * Gemini provider — implements AiProvider using Google's Gemini REST API
 * directly (no SDK dependency, just fetch — no vendor SDK leaks past this
 * file, which is the discipline every provider-<name>.ts file should follow).
 *
 * Required env vars:
 *   AI_PROVIDER=gemini      (activates this provider — see service.ts)
 *   GEMINI_API_KEY=...      (required, throws clearly if missing)
 *   GEMINI_MODEL=...        (optional — defaults to DEFAULT_MODEL below;
 *                            change models any time without touching code,
 *                            e.g. "gemini-3.5-flash" for heavier reasoning)
 *
 * Docs: https://ai.google.dev/api/generate-content
 */

import type { AiProvider, ChatMessage } from "./service";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Only used when GEMINI_MODEL is unset — never hardcoded into a request path.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}
interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
}
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

export interface GeminiCallResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your environment to use AI_PROVIDER=gemini."
    );
  }
  return key;
}

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Exported so other server-only code (e.g. image-analysis.ts) can read
 * the active Gemini model name for usage-tracking without duplicating the
 * env var lookup. */
export function getGeminiModel(): string {
  return getModel();
}

/**
 * Gemini's REST format differs from our ChatMessage[] in two ways:
 *  - the assistant's turn is called "model", not "assistant"
 *  - system prompts are a separate top-level `systemInstruction` field,
 *    not a message inside `contents`
 */
function toGeminiRequest(messages: ChatMessage[]): GeminiRequestBody {
  const systemParts: { text: string }[] = [];
  const contents: GeminiContent[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push({ text: m.content });
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  return {
    contents,
    ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
  };
}

/** The app only ever produces base64 data URLs for images (canvas.toDataURL
 * in use-camera.ts) — never remote http(s) URLs — so that's the only shape
 * supported here. Fails loudly rather than silently mishandling anything else. */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error(
      "Gemini provider only supports base64 data URLs for images (e.g. canvas.toDataURL())."
    );
  }
  return { mimeType: match[1], data: match[2] };
}

/** Full call with usage metadata. Exported for callers that need token
 * counts (e.g. the image-analysis usage tracker) — callGemini() below
 * wraps this and is unchanged for every existing caller. */
export async function callGeminiRaw(body: GeminiRequestBody): Promise<GeminiCallResult> {
  const model = getModel();
  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");

  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Gemini returned no text (finishReason: ${finishReason})`
        : "Gemini returned an empty response"
    );
  }
  return {
    text,
    model,
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
  };
}

async function callGemini(body: GeminiRequestBody): Promise<string> {
  return (await callGeminiRaw(body)).text;
}

/** Text chat with usage metadata — thin convenience wrapper around
 * toGeminiRequest + callGeminiRaw for server-only callers (e.g. the
 * image-analysis reviewer) that need token counts, without duplicating
 * the ChatMessage[] → Gemini request-shape conversion. */
export async function geminiChatRaw(messages: ChatMessage[]): Promise<GeminiCallResult> {
  return callGeminiRaw(toGeminiRequest(messages));
}

/** Vision (image analysis) with usage metadata — thin convenience wrapper
 * around callGeminiRaw for server-only callers (e.g. the image-analysis
 * pipeline) that need token counts. Accepts prompt and base64 data URLs. */
export async function geminiVisionRaw(
  prompt: string,
  images: string[],
  opts: { jsonMode?: boolean } = {}
): Promise<GeminiCallResult> {
  const parts: GeminiPart[] = [{ text: prompt }];
  for (const img of images) {
    const { mimeType, data } = parseDataUrl(img);
    parts.push({ inlineData: { mimeType, data } });
  }
  return callGeminiRaw({ contents: [{ role: "user", parts }] });
}

export function createGeminiProvider(): AiProvider {
  return {
    name: "gemini",

    async chat(messages: ChatMessage[]): Promise<string> {
      return callGemini(toGeminiRequest(messages));
    },

    async vision(prompt: string, images: string[]): Promise<string> {
      const parts: GeminiPart[] = [{ text: prompt }];
      for (const img of images) {
        const { mimeType, data } = parseDataUrl(img);
        parts.push({ inlineData: { mimeType, data } });
      }
      return callGemini({ contents: [{ role: "user", parts }] });
    },
  };
}
