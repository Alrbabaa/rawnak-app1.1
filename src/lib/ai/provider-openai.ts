/**
 * OpenAI provider — implements AiProvider using OpenAI's REST API directly
 * (no SDK dependency, same discipline as provider-gemini.ts: just fetch,
 * no vendor SDK leaks past this file).
 *
 * Required env vars:
 *   OPENAI_API_KEY=...      (required, throws clearly if missing)
 *   OPENAI_MODEL=...        (optional — defaults to DEFAULT_MODEL below)
 *
 * SECURITY: this key is read from process.env only. Never read
 * NEXT_PUBLIC_OPENAI_API_KEY or any NEXT_PUBLIC_* var here — that would
 * ship the key to the browser bundle. This file must only ever run
 * server-side (route handlers with `export const runtime = "nodejs"`,
 * or other server-only modules).
 *
 * Currently used for: primary visual analysis in the image-analysis
 * pipeline (see image-analysis.ts). Also implements the full AiProvider
 * interface (chat + vision) so it can be selected as AI_PROVIDER=openai
 * via service.ts like any other provider, even though the app's default
 * remains Gemini for everything except the image-analysis pipeline.
 *
 * Docs: https://platform.openai.com/docs/api-reference/chat
 */

import type { AiProvider, ChatMessage } from "./service";

const API_URL = "https://api.openai.com/v1/chat/completions";
// Only used when OPENAI_MODEL is unset — never hardcoded into a request path.
const DEFAULT_MODEL = "gpt-4o-mini";

export interface OpenAiCallResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your environment to use OpenAI vision analysis."
    );
  }
  return key;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

interface OpenAiChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface OpenAiChatMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAiChatContentPart[];
}

interface OpenAiRequestBody {
  model: string;
  messages: OpenAiChatMessage[];
  response_format?: { type: "json_object" };
}

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

async function callOpenAi(body: OpenAiRequestBody): Promise<OpenAiCallResult> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as OpenAiResponse;
  const text = data.choices?.[0]?.message?.content || "";

  if (!text) {
    const finishReason = data.choices?.[0]?.finish_reason;
    throw new Error(
      finishReason
        ? `OpenAI returned no text (finish_reason: ${finishReason})`
        : "OpenAI returned an empty response"
    );
  }

  return {
    text,
    model: body.model,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

/** Plain text chat, full usage metadata included — used by the generic
 * AiProvider.chat() below and available directly for callers that need
 * token counts (e.g. usage tracking). */
export async function openAiChatRaw(
  messages: ChatMessage[],
  opts: { jsonMode?: boolean } = {}
): Promise<OpenAiCallResult> {
  return callOpenAi({
    model: getOpenAiModel(),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
}

/** Vision call, full usage metadata included. The app only ever produces
 * base64 data URLs for images (canvas.toDataURL in use-camera.ts) — the
 * OpenAI API accepts those directly as image_url.url, no re-encoding
 * needed. */
export async function openAiVisionRaw(
  prompt: string,
  images: string[],
  opts: { jsonMode?: boolean } = {}
): Promise<OpenAiCallResult> {
  const content: OpenAiChatContentPart[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: img } });
  }
  return callOpenAi({
    model: getOpenAiModel(),
    messages: [{ role: "user", content }],
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
}

export function createOpenAiProvider(): AiProvider {
  return {
    name: "openai",

    async chat(messages: ChatMessage[]): Promise<string> {
      return (await openAiChatRaw(messages)).text;
    },

    async vision(prompt: string, images: string[]): Promise<string> {
      return (await openAiVisionRaw(prompt, images)).text;
    },
  };
}
