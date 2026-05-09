import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TOTAL_STICKERS = 640;

export type StickerCatalogItem = {
  number: number;
  name: string;
  team: string;
  group_letter: string;
};

export function useStickerCatalog() {
  return useQuery({
    queryKey: ["stickers"],
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<StickerCatalogItem[]> => {
      const { data, error } = await supabase
        .from("stickers")
        .select("number,name,team,group_letter")
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });
}
