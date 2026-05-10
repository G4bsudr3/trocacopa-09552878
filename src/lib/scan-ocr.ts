// Client-side OCR for album pages using tesseract.js.
// We detect printed slot codes (e.g. "QAT 13", "FWC 1") which appear on EMPTY slots.
// Filled slots have a sticker glued on top, so their printed code is hidden.
// Therefore: detected codes => empty; complement within the page's country => filled.

import type { StickerCatalogItem } from "@/lib/stickers";

type CatalogSticker = StickerCatalogItem;

export type OcrPageResult = {
  filled: string[];
  empty: string[];
  page_hint: string | null;
  country_code: string | null;
  rawText: string;
};

// Lazy import to avoid bundling tesseract.js into the initial bundle.
async function getTesseract() {
  const mod = await import("tesseract.js");
  return mod;
}

function normalizeCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

// Pull tokens that look like sticker codes from OCR text.
// Patterns supported: ABC 12, ABC12, FWC 1, CC 14, 00, COV.
function extractCandidateCodes(text: string): string[] {
  const out = new Set<string>();
  const upper = text.toUpperCase();

  // Three-letter prefix + 1-3 digits (with optional space/hyphen)
  const reCountry = /\b([A-Z]{2,4})[\s\-]?(\d{1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reCountry.exec(upper)) !== null) {
    out.add(`${m[1]}${m[2]}`);
  }

  // Cover / standalone "00"
  if (/\b(00|COV)\b/.test(upper)) out.add("00");

  return [...out];
}

export async function ocrAlbumPage(
  imageDataUrl: string,
  catalog: CatalogSticker[],
  onProgress?: (p: number) => void,
): Promise<OcrPageResult> {
  const Tesseract = await getTesseract();

  const codeSet = new Set(catalog.map((s) => s.code.toUpperCase()));

  const result = await Tesseract.recognize(imageDataUrl, "eng", {
    logger: (info: { status: string; progress: number }) => {
      if (info.status === "recognizing text" && onProgress) {
        onProgress(info.progress);
      }
    },
    // Restrict to alphanumerics + space; speeds up and reduces noise.
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
  } as Parameters<typeof Tesseract.recognize>[2]);

  const rawText: string = result?.data?.text ?? "";
  const candidates = extractCandidateCodes(rawText);

  // Keep only codes that exist in the catalog
  const detected = candidates.filter((c) => codeSet.has(c));
  const detectedSet = new Set(detected);

  // Determine the page's country: most frequent prefix among detected codes.
  // Strip trailing digits to get the prefix (e.g. "NED12" -> "NED").
  const prefixCount = new Map<string, number>();
  for (const c of detected) {
    const prefix = c.replace(/\d+$/, "");
    prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1);
  }
  let countryCode: string | null = null;
  let bestCount = 0;
  for (const [k, v] of prefixCount.entries()) {
    if (v > bestCount) {
      bestCount = v;
      countryCode = k;
    }
  }

  // Build "filled" by complement: catalog codes sharing the same prefix
  // that were NOT detected by OCR (because a sticker covers the printed code).
  // We only do this when we have a confident country (>=2 hits) to avoid
  // marking a whole country as filled from a single false-positive.
  const empty = detected.slice();
  let filled: string[] = [];
  if (countryCode && bestCount >= 2) {
    const expected = catalog
      .map((s) => s.code.toUpperCase())
      .filter((c) => c.replace(/\d+$/, "") === countryCode);
    filled = expected.filter((c) => !detectedSet.has(c));
  }

  // Country name hint
  const countryName =
    catalog.find((s) => s.code.toUpperCase().startsWith(countryCode ?? "___"))?.country_name ?? null;
  const page_hint = countryCode
    ? countryName
      ? `${countryName} (${countryCode})`
      : countryCode
    : null;

  return {
    filled,
    empty,
    page_hint,
    country_code: countryCode,
    rawText,
  };
}
