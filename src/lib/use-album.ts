import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStickerCatalog, TOTAL_STICKERS, type StickerCatalogItem } from "@/lib/stickers";

export type Sticker = StickerCatalogItem & {
  owned: boolean;
  duplicates: number;
};

type Row = { sticker_code: string; duplicates: number };

export function useAlbum() {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const catalog = useStickerCatalog();

  const ownership = useQuery({
    queryKey: ["user_stickers", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("user_stickers")
        .select("sticker_code,duplicates")
        .eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const ownedMap = new Map<string, number>();
  (ownership.data ?? []).forEach((r) => ownedMap.set(r.sticker_code, r.duplicates));

  const stickers: Sticker[] = (catalog.data ?? []).map((s) => {
    const dup = ownedMap.get(s.code) ?? 0;
    return { ...s, owned: dup > 0, duplicates: dup };
  });

  const setMutation = useMutation({
    mutationFn: async ({ code, duplicates }: { code: string; duplicates: number }) => {
      if (!uid) throw new Error("not authed");
      if (duplicates <= 0) {
        const { error } = await supabase
          .from("user_stickers")
          .delete()
          .eq("user_id", uid)
          .eq("sticker_code", code);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_stickers")
          .upsert(
            { user_id: uid, sticker_code: code, duplicates },
            { onConflict: "user_id,sticker_code" },
          );
        if (error) throw error;
      }
    },
    onMutate: async ({ code, duplicates }) => {
      await qc.cancelQueries({ queryKey: ["user_stickers", uid] });
      const prev = qc.getQueryData<Row[]>(["user_stickers", uid]) ?? [];
      const next =
        duplicates <= 0
          ? prev.filter((r) => r.sticker_code !== code)
          : prev.some((r) => r.sticker_code === code)
            ? prev.map((r) => (r.sticker_code === code ? { ...r, duplicates } : r))
            : [...prev, { sticker_code: code, duplicates }];
      qc.setQueryData(["user_stickers", uid], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user_stickers", uid], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["user_stickers", uid] });
      qc.invalidateQueries({ queryKey: ["profile", uid] });
      refreshProfile();
    },
  });

  const get = (c: string) => ownedMap.get(c) ?? 0;

  return {
    stickers,
    total: TOTAL_STICKERS,
    isLoading: catalog.isLoading || ownership.isLoading,
    toggleOwned: (c: string) => setMutation.mutate({ code: c, duplicates: get(c) > 0 ? 0 : 1 }),
    addDuplicate: (c: string) => setMutation.mutate({ code: c, duplicates: get(c) + 1 }),
    removeDuplicate: (c: string) => setMutation.mutate({ code: c, duplicates: Math.max(0, get(c) - 1) }),
    setSticker: (c: string, _owned: boolean, dup: number) => setMutation.mutate({ code: c, duplicates: dup }),
    reset: async () => {
      if (!uid) return;
      await supabase.from("user_stickers").delete().eq("user_id", uid);
      qc.invalidateQueries({ queryKey: ["user_stickers", uid] });
      qc.invalidateQueries({ queryKey: ["profile", uid] });
    },
  };
}
