/**
 * AI Service Layer — provider-agnostic abstraction over LLM/VLM calls.
 *
 * Design goals:
 *  - All application code depends on `AiService`, never on a specific SDK.
 *  - Swapping or adding a provider (Gemini, OpenAI, Anthropic, Grok,
 *    DeepSeek, Mistral, OpenRouter, ...) requires editing ONLY the provider
 *    registry below and adding a new provider file. No route or business
 *    logic changes.
 *  - Business concerns (retries, JSON extraction, error normalization) live
 *    here, not scattered across route handlers.
 *
 * Architecture:
 *   route handler  →  AiService (this file)  →  AiProvider (interface)
 *                                                  ↑
 *                    provider-gemini.ts implements it as a dedicated file —
 *                    the pattern every provider (current and future) follows.
 *
 * To activate Gemini (the current default): set AI_PROVIDER=gemini,
 * GEMINI_API_KEY=..., and optionally GEMINI_MODEL=... (see
 * provider-gemini.ts). No code change needed — just environment variables.
 *
 * To add a new provider:
 *   1. Create `src/lib/ai/provider-<name>.ts` implementing `AiProvider`.
 *   2. Add one `case` to the switch in `getAiProvider()` below, importing
 *      that file's factory function.
 *   3. Add its required API key env var(s) to `.env.example`.
 *   Done — no other file changes.
 */

import { extractJson } from "@/lib/json-extract";
import { createGeminiProvider } from "@/lib/ai/provider-gemini";
import { createOpenAiProvider } from "@/lib/ai/provider-openai";

/* ============ Types ============ */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VisionContent {
  text: string;
  imageUrl: string; // data URL or http URL
}

export interface AiProvider {
  /** Plain text chat completion. */
  chat(messages: ChatMessage[]): Promise<string>;
  /** Vision completion — text + one or more images. */
  vision(prompt: string, images: string[]): Promise<string>;
  /** Human-readable provider name (for logging/health checks). */
  readonly name: string;
}

/* ============ Provider registry ============ */

let cachedProvider: AiProvider | null = null;

/**
 * Returns the active AI provider singleton.
 * Provider is selected via AI_PROVIDER env var (defaults to "gemini").
 * To add a provider: implement AiProvider in its own provider-<name>.ts
 * file, import its factory here, and add one `case` below.
 */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER || "gemini";

  switch (providerName) {
    case "gemini":
      cachedProvider = createGeminiProvider();
      break;
    case "openai":
      cachedProvider = createOpenAiProvider();
      break;
    // case "anthropic":
    //   cachedProvider = createAnthropicProvider();
    //   break;
    // case "grok":
    //   cachedProvider = createGrokProvider();
    //   break;
    // case "deepseek":
    //   cachedProvider = createDeepSeekProvider();
    //   break;
    // case "mistral":
    //   cachedProvider = createMistralProvider();
    //   break;
    // case "openrouter":
    //   cachedProvider = createOpenRouterProvider();
    //   break;
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }

  return cachedProvider;
}

/* ============ Service facade ============ */

/**
 * High-level AI service. This is what business logic should call.
 * Wraps the provider with retries, JSON extraction, and error normalization.
 */
export const aiService = {
  /**
   * Plain text chat — returns the assistant's text response.
   * Use for conversational replies (e.g. the chat screen).
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    return getAiProvider().chat(messages);
  },

  /**
   * Text → structured JSON.
   * Retries once if the model returns non-parseable output, appending a
   * "return valid JSON only" hint on the second attempt.
   */
  async chatJson<T>(
    systemPrompt: string,
    userContent: string,
    maxAttempts = 2
  ): Promise<T> {
    const provider = getAiProvider();
    let lastRaw = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryHint =
        attempt > 1
          ? "\n\nمهم جدًا: أرجعي JSON صالحًا فقط بدون أي نص أو شرح قبل أو بعد. لا تستخدمي علامات markdown."
          : "";

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt + retryHint },
        { role: "user", content: userContent },
      ];

      const raw = await provider.chat(messages);
      lastRaw = raw;

      const parsed = extractJson<T>(raw);
      if (parsed !== null) return parsed;
    }

    throw new Error(
      `Failed to parse AI JSON after ${maxAttempts} attempts. Raw: ${lastRaw.slice(0, 200)}`
    );
  },

  /**
   * Vision → structured JSON. Sends prompt + image(s), expects JSON back.
   * Used by skin-analysis and product-scan.
   */
  async visionJson<T>(
    prompt: string,
    images: string[],
    maxAttempts = 2
  ): Promise<T> {
    const provider = getAiProvider();
    let lastRaw = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryHint =
        attempt > 1
          ? "\n\nمهم جدًا: أرجعي JSON صالحًا فقط بدون أي نص إضافي."
          : "";

      const raw = await provider.vision(prompt + retryHint, images);
      lastRaw = raw;

      const parsed = extractJson<T>(raw);
      if (parsed !== null) return parsed;
    }

    throw new Error(
      `Failed to parse vision JSON after ${maxAttempts} attempts. Raw: ${lastRaw.slice(0, 200)}`
    );
  },
};
