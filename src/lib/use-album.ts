import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStickerCatalog, TOTAL_STICKERS, type StickerCatalogItem } from "@/lib/stickers";

export type Sticker = StickerCatalogItem & {
  owned: boolean;
  duplicates: number;
};

type Row = { sticker_number: number; duplicates: number };

export function useAlbum() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const catalog = useStickerCatalog();

  const ownership = useQuery({
    queryKey: ["user_stickers", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("user_stickers")
        .select("sticker_number,duplicates")
        .eq("user_id", uid!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownedMap = new Map<number, number>();
  (ownership.data ?? []).forEach((r) => ownedMap.set(r.sticker_number, r.duplicates));

  const stickers: Sticker[] = (catalog.data ?? []).map((s) => {
    const dup = ownedMap.get(s.number) ?? 0;
    return { ...s, owned: dup > 0, duplicates: dup };
  });

  const setMutation = useMutation({
    mutationFn: async ({ number, duplicates }: { number: number; duplicates: number }) => {
      if (!uid) throw new Error("not authed");
      if (duplicates <= 0) {
        const { error } = await supabase
          .from("user_stickers")
          .delete()
          .eq("user_id", uid)
          .eq("sticker_number", number);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_stickers")
          .upsert({ user_id: uid, sticker_number: number, duplicates }, { onConflict: "user_id,sticker_number" });
        if (error) throw error;
      }
    },
    onMutate: async ({ number, duplicates }) => {
      await qc.cancelQueries({ queryKey: ["user_stickers", uid] });
      const prev = qc.getQueryData<Row[]>(["user_stickers", uid]) ?? [];
      const next = duplicates <= 0
        ? prev.filter((r) => r.sticker_number !== number)
        : prev.some((r) => r.sticker_number === number)
          ? prev.map((r) => (r.sticker_number === number ? { ...r, duplicates } : r))
          : [...prev, { sticker_number: number, duplicates }];
      qc.setQueryData(["user_stickers", uid], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user_stickers", uid], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["user_stickers", uid] });
      qc.invalidateQueries({ queryKey: ["profile", uid] });
    },
  });

  const get = (n: number) => ownedMap.get(n) ?? 0;

  return {
    stickers,
    total: TOTAL_STICKERS,
    isLoading: catalog.isLoading || ownership.isLoading,
    toggleOwned: (n: number) => setMutation.mutate({ number: n, duplicates: get(n) > 0 ? 0 : 1 }),
    addDuplicate: (n: number) => setMutation.mutate({ number: n, duplicates: get(n) + 1 }),
    removeDuplicate: (n: number) => setMutation.mutate({ number: n, duplicates: Math.max(0, get(n) - 1) }),
    setSticker: (n: number, _owned: boolean, dup: number) => setMutation.mutate({ number: n, duplicates: dup }),
    reset: async () => {
      if (!uid) return;
      await supabase.from("user_stickers").delete().eq("user_id", uid);
      qc.invalidateQueries({ queryKey: ["user_stickers", uid] });
      qc.invalidateQueries({ queryKey: ["profile", uid] });
    },
  };
}
