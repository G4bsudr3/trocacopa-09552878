// Album-page scan delegates to the `scan-album-page` edge function (Gemini 2.5 Pro multimodal).
// The previous client-side Tesseract OCR was too unreliable on Panini codes.

import { supabase } from "@/integrations/supabase/client";
import type { StickerCatalogItem } from "@/lib/stickers";

export type OcrPageResult = {
  filled: string[];
  empty: string[];
  page_hint: string | null;
  country_code: string | null;
  rawText: string;
};

// Downscale a data URL so the upload to the edge function stays small but readable.
async function downscaleDataUrl(dataUrl: string, maxSide = 1600, quality = 0.85): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale >= 1) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export async function ocrAlbumPage(
  imageDataUrl: string,
  _catalog: StickerCatalogItem[],
  _onProgress?: (p: number) => void,
): Promise<OcrPageResult> {
  const image = await downscaleDataUrl(imageDataUrl, 1600, 0.85);

  const { data, error } = await supabase.functions.invoke("scan-album-page", {
    body: { image },
  });
  if (error) throw new Error(error.message || "scan-album-page failed");
  if (data?.error === "rate_limited") throw new Error("Muitas requisições, aguarde um instante");
  if (data?.error === "credits_exhausted") throw new Error("Créditos de IA esgotados");
  if (data?.error) throw new Error(String(data.error));

  const filled: string[] = Array.isArray(data?.filled) ? data.filled : [];
  const empty: string[] = Array.isArray(data?.empty) ? data.empty : [];

  return {
    filled,
    empty,
    page_hint: data?.page_hint ?? null,
    country_code: data?.country_code ?? null,
    rawText: "",
  };
}
