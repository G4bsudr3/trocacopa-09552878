import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type UnreadCategory = "trades" | "messages" | "matches";

type Row = { id: string; type: string; read: boolean };

export function categoryFor(type: string): UnreadCategory | null {
  if (type === "trade_message") return "messages";
  if (type === "match_high") return "matches";
  if (type.startsWith("trade_")) return "trades";
  return null;
}

export function useUnreadNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,read")
        .eq("user_id", user!.id)
        .eq("read", false)
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const name = `unread-${user.id}`;
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${name}` || c.topic === name) supabase.removeChannel(c);
    });
    const ch = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["unread", user.id] });
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return useMemo(() => {
    const rows = q.data ?? [];
    const byCategory = { trades: 0, messages: 0, matches: 0 };
    for (const r of rows) {
      const c = categoryFor(r.type);
      if (c) byCategory[c]++;
    }
    const total = rows.length;
    let top: UnreadCategory | null = null;
    let max = 0;
    (["matches", "messages", "trades"] as const).forEach((k) => {
      if (byCategory[k] > max) { max = byCategory[k]; top = k; }
    });
    return { total, byCategory, top, isLoading: q.isLoading };
  }, [q.data, q.isLoading]);
}
