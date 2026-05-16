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
  return Array.from(map.values());
}
