import { useEffect, useState, useCallback } from "react";
import { generateStickers, type Sticker, TOTAL_STICKERS } from "./mock-data";

const KEY = "trocacopa.album.v1";

type Overrides = Record<number, { owned: boolean; duplicates: number }>;

function loadOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function useAlbum() {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [base] = useState<Sticker[]>(() => generateStickers());

  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  const persist = (next: Overrides) => {
    setOverrides(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  const stickers: Sticker[] = base.map((s) => {
    const o = overrides[s.number];
    if (!o) return s;
    return { ...s, owned: o.owned, duplicates: o.duplicates };
  });

  const setSticker = useCallback(
    (num: number, owned: boolean, duplicates: number) => {
      const next = {
        ...overrides,
        [num]: { owned, duplicates: Math.max(0, duplicates) },
      };
      persist(next);
    },
    [overrides]
  );

  const toggleOwned = useCallback(
    (num: number) => {
      const cur = stickers.find((s) => s.number === num);
      if (!cur) return;
      setSticker(num, !cur.owned, cur.owned ? 0 : 1);
    },
    [stickers, setSticker]
  );

  const addDuplicate = useCallback(
    (num: number) => {
      const cur = stickers.find((s) => s.number === num);
      if (!cur) return;
      setSticker(num, true, (cur.duplicates || 1) + 1);
    },
    [stickers, setSticker]
  );

  const removeDuplicate = useCallback(
    (num: number) => {
      const cur = stickers.find((s) => s.number === num);
      if (!cur) return;
      const d = (cur.duplicates || 1) - 1;
      setSticker(num, d > 0, Math.max(0, d));
    },
    [stickers, setSticker]
  );

  const reset = useCallback(() => persist({}), []);

  return {
    stickers,
    total: TOTAL_STICKERS,
    setSticker,
    toggleOwned,
    addDuplicate,
    removeDuplicate,
    reset,
  };
}
