/**
 * Image Analysis pipeline — orchestrates two independent providers for a
 * single image analysis request:
 *
 *   Image → OpenAI Vision (primary analysis) → Gemini (independent review)
 *         → Final Structured Result
 *
 * This is a dedicated orchestration layer, deliberately NOT built on top
 * of `aiService.visionJson()` — that facade picks exactly one provider via
 * AI_PROVIDER and is the right tool for every other AI feature in the app
 * (chat, routines, recommendations, ...), but image analysis needs two
 * specific providers with two specific roles, so it talks to
 * provider-openai.ts and provider-gemini.ts directly.
 *
 * Every other AI feature in the app is untouched by this file and keeps
 * using `aiService` (Gemini, via AI_PROVIDER) exactly as before.
 *
 * Env vars (see .env.example):
 *   IMAGE_ANALYSIS_REVIEW_ENABLED=true|false   (default: true)
 *   IMAGE_ANALYSIS_FALLBACK_ENABLED=true|false (default: false)
 *   OPENAI_API_KEY / OPENAI_MODEL
 *   GEMINI_API_KEY / GEMINI_MODEL
 */

import { FieldValue } from "firebase-admin/firestore";
import { openAiVisionRaw, getOpenAiModel } from "@/lib/ai/provider-openai";
import { geminiChatRaw, geminiVisionRaw } from "@/lib/ai/provider-gemini";
import { extractJson } from "@/lib/json-extract";
import { adminDb } from "@/lib/firebase/admin";

/* ============ Public types ============ */

/** OpenAI's primary, unreviewed analysis. Domain-specific structured data
 * (e.g. skin metrics) lives in `data`; the rest is the safety envelope
 * every image analysis carries regardless of domain. */
export interface ImageAnalysisDraft<T> {
  data: T;
  observations: string[];
  possibleConcerns: string[];
  confidence: number; // 0-100
  visibleFeatures: string[];
  limitations: string[];
}

export type ReviewStatus =
  | "agreed"
  | "partially_agreed"
  | "uncertain"
  | "review_unavailable";

/** Final result after Gemini's independent review (or the draft alone,
 * clearly marked, when review is disabled/unavailable). */
export interface FinalImageAnalysis<T> {
  data: T;
  observations: string[];
  possibleConcerns: string[];
  recommendations: string[];
  confidence: number; // 0-100
  limitations: string[];
  reviewStatus: ReviewStatus;
}

export interface AnalyzeImageOptions<T> {
  userId: string;
  /** Feature id used for usage-tracking tags, e.g. "skinAnalysis". */
  feature: string;
  images: string[];
  /** Full prompt instructing OpenAI to return an ImageAnalysisDraft<T>
   * JSON object. Must describe T's shape explicitly (this layer doesn't
   * know T's schema — only the caller does). */
  primaryPrompt: string;
  /** Given OpenAI's draft, build the full prompt for Gemini's independent
   * review. Must instruct Gemini to return a FinalImageAnalysis<T> JSON
   * object (reviewStatus excluded — this layer sets that field itself
   * based on whether the review actually ran and succeeded). */
  buildReviewPrompt: (draft: ImageAnalysisDraft<T>) => string;
}

export class ImageAnalysisError extends Error {
  constructor(
    message: string,
    public readonly stage: "primary" | "review"
  ) {
    super(message);
    this.name = "ImageAnalysisError";
  }
}

/* ============ Config ============ */

function reviewEnabled(): boolean {
  return process.env.IMAGE_ANALYSIS_REVIEW_ENABLED !== "false";
}

function fallbackEnabled(): boolean {
  return process.env.IMAGE_ANALYSIS_FALLBACK_ENABLED === "true";
}

/** IMAGE_ANALYSIS_PROVIDER / IMAGE_ANALYSIS_REVIEWER are read (not just
 * documented) so the settings in .env.example are true to what actually
 * runs. Only "openai" (primary) + "gemini" (reviewer) are implemented in
 * this pipeline today — anything else fails loudly at call time instead
 * of silently running the wrong provider, so misconfiguration is caught
 * immediately rather than producing a confusing mismatch later. */
function assertConfiguredProviders(): void {
  const primary = process.env.IMAGE_ANALYSIS_PROVIDER?.trim() || "openai";
  const reviewer = process.env.IMAGE_ANALYSIS_REVIEWER?.trim() || "gemini";
  if (primary !== "openai") {
    throw new Error(
      `IMAGE_ANALYSIS_PROVIDER="${primary}" is not supported. Only "openai" is implemented for the image-analysis primary stage.`
    );
  }
  if (reviewer !== "gemini") {
    throw new Error(
      `IMAGE_ANALYSIS_REVIEWER="${reviewer}" is not supported. Only "gemini" is implemented for the image-analysis review stage.`
    );
  }
}

/* ============ Usage tracking (best-effort, never blocks the response) ============ */

interface UsageLogEntry {
  userId: string;
  feature: string;
  analysisId: string;
  primaryProvider: "openai" | "gemini";
  reviewProvider: "gemini" | null;
  primaryModel: string;
  reviewModel: string | null;
  timestamp: FirebaseFirestore.FieldValue;
  primaryInputTokens: number | null;
  primaryOutputTokens: number | null;
  reviewInputTokens: number | null;
  reviewOutputTokens: number | null;
  totalTokens: number | null;
}

async function logUsage(entry: Omit<UsageLogEntry, "timestamp">) {
  try {
    await adminDb.collection("imageAnalysisUsage").add({
      ...entry,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Never let logging failures break the actual analysis response.
    console.error("[image-analysis] usage logging failed:", err);
  }
}

/* ============ Draft validation ============ */

function isValidDraft<T>(v: unknown): v is ImageAnalysisDraft<T> {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    "data" in d &&
    Array.isArray(d.observations) &&
    Array.isArray(d.possibleConcerns) &&
    typeof d.confidence === "number" &&
    Array.isArray(d.visibleFeatures) &&
    Array.isArray(d.limitations)
  );
}

function isValidFinal<T>(
  v: unknown
): v is Omit<FinalImageAnalysis<T>, "reviewStatus"> {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return (
    "data" in f &&
    Array.isArray(f.observations) &&
    Array.isArray(f.possibleConcerns) &&
    Array.isArray(f.recommendations) &&
    typeof f.confidence === "number" &&
    Array.isArray(f.limitations)
  );
}

function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function draftToFinal<T>(
  draft: ImageAnalysisDraft<T>,
  reviewStatus: ReviewStatus
): FinalImageAnalysis<T> {
  return {
    data: draft.data,
    observations: draft.observations,
    possibleConcerns: draft.possibleConcerns,
    recommendations: [],
    confidence: clampConfidence(draft.confidence),
    limitations: draft.limitations,
    reviewStatus,
  };
}

/* ============ Main orchestration ============ */

export async function analyzeImage<T>(
  opts: AnalyzeImageOptions<T>
): Promise<FinalImageAnalysis<T>> {
  assertConfiguredProviders();

  const analysisId =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ||
    `ia_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  /* ---- Stage 1: OpenAI primary analysis ---- */
  let draft: ImageAnalysisDraft<T>;
  let primaryModel = getOpenAiModel();
  let primaryTokens = { in: null as number | null, out: null as number | null };
  let primaryProvider: "openai" | "gemini" = "openai";

  try {
    const result = await openAiVisionRaw(opts.primaryPrompt, opts.images, {
      jsonMode: true,
    });
    const parsed = extractJson<unknown>(result.text);
    if (!isValidDraft<T>(parsed)) {
      throw new Error("OpenAI returned a draft with an unexpected shape.");
    }
    draft = parsed;
    primaryModel = result.model;
    primaryTokens = { in: result.inputTokens ?? null, out: result.outputTokens ?? null };
  } catch (primaryErr) {
    if (!fallbackEnabled()) {
      throw new ImageAnalysisError(
        primaryErr instanceof Error ? primaryErr.message : "OpenAI vision analysis failed",
        "primary"
      );
    }

    // Safe, explicit fallback: use Gemini alone as the primary analyzer.
    // No "review" is meaningful when the same provider would be reviewing
    // itself, so the result is returned as-is with reviewStatus marking
    // that review never ran, rather than faking a two-provider consensus.
    // Must still pass the actual image — without it Gemini would be
    // fabricating an analysis from the text prompt alone, which is exactly
    // the "fake result" failure mode this pipeline exists to avoid.
    try {
      const fallback = await geminiVisionRaw(opts.primaryPrompt, opts.images);
      const parsed = extractJson<unknown>(fallback.text);
      if (!isValidDraft<T>(parsed)) {
        throw new Error("Gemini fallback returned a draft with an unexpected shape.");
      }
      draft = parsed;
      primaryProvider = "gemini";
      primaryModel = fallback.model;
      primaryTokens = { in: fallback.inputTokens ?? null, out: fallback.outputTokens ?? null };
    } catch (fallbackErr) {
      throw new ImageAnalysisError(
        fallbackErr instanceof Error
          ? fallbackErr.message
          : "Both OpenAI and the Gemini fallback failed",
        "primary"
      );
    }
  }

  /* ---- Stage 2: Gemini independent review (optional, cost-controlled) ---- */
  if (!reviewEnabled() || primaryProvider !== "openai") {
    const final = draftToFinal(draft, "review_unavailable");
    await logUsage({
      userId: opts.userId,
      feature: opts.feature,
      analysisId,
      primaryProvider,
      reviewProvider: null,
      primaryModel,
      reviewModel: null,
      primaryInputTokens: primaryTokens.in,
      primaryOutputTokens: primaryTokens.out,
      reviewInputTokens: null,
      reviewOutputTokens: null,
      totalTokens:
        primaryTokens.in !== null && primaryTokens.out !== null
          ? primaryTokens.in + primaryTokens.out
          : null,
    });
    return final;
  }

  try {
    const reviewPrompt = opts.buildReviewPrompt(draft);
    // Text-only on purpose: the reviewer checks the primary model's JSON
    // for internal consistency (unsupported claims, contradictions, an
    // isUsable verdict that doesn't match its own observations/
    // limitations) without also re-processing the image — sending the
    // photo to a second vision model on every request would double the
    // image-analysis cost of each call for a check that's still useful
    // done on the text alone.
    const reviewResult = await geminiChatRaw([{ role: "user", content: reviewPrompt }]);
    const parsedReview = extractJson<unknown>(reviewResult.text);

    if (!isValidFinal<T>(parsedReview)) {
      throw new Error("Gemini review returned a result with an unexpected shape.");
    }

    // Trust the reviewer's own reviewStatus if it supplied a valid one;
    // otherwise default conservatively.
    const reviewStatus: ReviewStatus =
      "reviewStatus" in (parsedReview as Record<string, unknown>) &&
      ["agreed", "partially_agreed", "uncertain"].includes(
        (parsedReview as Record<string, unknown>).reviewStatus as string
      )
        ? ((parsedReview as Record<string, unknown>).reviewStatus as ReviewStatus)
        : "uncertain";

    const final: FinalImageAnalysis<T> = {
      data: parsedReview.data,
      observations: parsedReview.observations,
      possibleConcerns: parsedReview.possibleConcerns,
      recommendations: parsedReview.recommendations,
      confidence: clampConfidence(parsedReview.confidence),
      limitations: parsedReview.limitations,
      reviewStatus,
    };

    await logUsage({
      userId: opts.userId,
      feature: opts.feature,
      analysisId,
      primaryProvider: "openai",
      reviewProvider: "gemini",
      primaryModel,
      reviewModel: reviewResult.model,
      primaryInputTokens: primaryTokens.in,
      primaryOutputTokens: primaryTokens.out,
      reviewInputTokens: reviewResult.inputTokens ?? null,
      reviewOutputTokens: reviewResult.outputTokens ?? null,
      totalTokens:
        [primaryTokens.in, primaryTokens.out, reviewResult.inputTokens, reviewResult.outputTokens].every(
          (n) => n !== null && n !== undefined
        )
          ? (primaryTokens.in as number) +
            (primaryTokens.out as number) +
            (reviewResult.inputTokens as number) +
            (reviewResult.outputTokens as number)
          : null,
    });

    return final;
  } catch (reviewErr) {
    // Gemini reviewer failing does NOT fail the whole request — OpenAI's
    // draft is still a valid, usable result. Mark it clearly instead.
    console.error("[image-analysis] review stage failed:", reviewErr);
    const final = draftToFinal(draft, "review_unavailable");
    await logUsage({
      userId: opts.userId,
      feature: opts.feature,
      analysisId,
      primaryProvider: "openai",
      reviewProvider: "gemini",
      primaryModel,
      reviewModel: null,
      primaryInputTokens: primaryTokens.in,
      primaryOutputTokens: primaryTokens.out,
      reviewInputTokens: null,
      reviewOutputTokens: null,
      totalTokens:
        primaryTokens.in !== null && primaryTokens.out !== null
          ? primaryTokens.in + primaryTokens.out
          : null,
    });
    return final;
  }
}
