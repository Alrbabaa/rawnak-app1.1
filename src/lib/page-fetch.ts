/**
 * Generic web page fetcher — plain HTTP fetch, no AI/provider SDK involved.
 *
 * Previously, `import-product` used the Z.AI SDK's `page_reader` function
 * tool to retrieve a product page's title/HTML before handing the text to
 * the LLM for extraction. That was a vendor-specific convenience function,
 * not an AI capability, so it doesn't belong behind the AiProvider
 * abstraction (src/lib/ai/service.ts) — it belongs here, as a plain network
 * fetch any provider can be paired with.
 */

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; RawnakBot/1.0; +https://rawnak.app) product-import";

export interface FetchedPage {
  title: string;
  html: string;
}

/**
 * Fetches a URL and returns its raw title + HTML.
 * Throws on network failure, non-2xx status, or timeout.
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`Page fetch failed with status ${res.status}`);
    }

    const html = await res.text();
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? titleMatch[1].trim() : "";

    return { title, html };
  } finally {
    clearTimeout(timeout);
  }
}

/** Strips scripts/styles/tags and collapses whitespace to plain text. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
