/**
 * Robustly extracts JSON from an LLM text response.
 * Handles markdown code fences, leading/trailing prose, and greedy matching.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const cleaned = text
    .replace(/```(?:json|JSON)?\s*/g, "")
    .replace(/```/g, "")
    .trim();

  // Direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // ignore, try regex
  }

  // Try object match first
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T;
    } catch {
      // ignore
    }
  }

  // Try array match
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]) as T;
    } catch {
      // ignore
    }
  }

  return null;
}
