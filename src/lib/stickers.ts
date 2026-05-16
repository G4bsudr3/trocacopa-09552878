import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TOTAL_STICKERS = 980;

export type StickerKind = "cover" | "country" | "history" | "special" | "crest" | "team" | "player";

export type StickerCatalogItem = {
  code: string;
  country_code: string;
  country_name: string;
  position: number;
  kind: StickerKind;
  group_letter: string;
  flag_emoji: string;
  image_url: string | null;
  player_name: string | null;
};

export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

// Ordem oficial dos países dentro de cada grupo, conforme o álbum Panini FWC 26.
const COUNTRY_ORDER_LIST: Record<string, string[]> = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COL", "COD", "UZB"],
  L: ["ENG", "CRO", "GHA", "PAN"],
};

const COUNTRY_ORDER_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const [, codes] of Object.entries(COUNTRY_ORDER_LIST)) {
    codes.forEach((code, i) => {
      map[code] = i;
    });
  }
  return map;
})();

function countryOrderIndex(code: string): number {
  const i = COUNTRY_ORDER_INDEX[code.toUpperCase()];
  return i === undefined ? 999 : i;
}

export function useStickerCatalog() {
  return useQuery({
    queryKey: ["stickers"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<StickerCatalogItem[]> => {
      const { data, error } = await supabase
        .from("stickers")
        .select("code,country_code,country_name,position,kind,group_letter,flag_emoji,image_url,player_name")
        .order("group_letter")
        .order("country_code")
        .order("position");
      if (error) throw error;
      return (data ?? []) as StickerCatalogItem[];
    },
  });
}

export type CountryGroup = {
  country_code: string;
  country_name: string;
  flag_emoji: string;
  group_letter: string;
  stickers: StickerCatalogItem[];
};

export function groupByCountry(items: StickerCatalogItem[]): CountryGroup[] {
  const map = new Map<string, CountryGroup>();
  for (const s of items) {
    const key = s.country_code;
    if (!map.has(key)) {
      map.set(key, {
        country_code: s.country_code,
        country_name: s.country_name,
        flag_emoji: s.flag_emoji,
        group_letter: s.group_letter,
        stickers: [],
      });
    }
    map.get(key)!.stickers.push(s);
  }
  for (const g of map.values()) g.stickers.sort((a, b) => a.position - b.position);
  return Array.from(map.values()).sort((a, b) => {
    if (a.group_letter !== b.group_letter) return a.group_letter.localeCompare(b.group_letter);
    return countryOrderIndex(a.country_code) - countryOrderIndex(b.country_code);
  });
}
