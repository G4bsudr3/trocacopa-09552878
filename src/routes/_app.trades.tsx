import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/trades")({
  head: () => ({ meta: [{ title: "Minhas Trocas — TrocaCopa" }] }),
  component: Trades,
});

type Tab = "all" | "pending" | "accepted" | "completed" | "closed";

type TradeWithProfiles = {
  id: string;
  status: string;
  created_at: string;
  requester_id: string;
  receiver_id: string;
  offered_stickers: string[];
  requested_stickers: string[];
  requester: { full_name: string | null; avatar_url: string | null } | null;
  receiver: { full_name: string | null; avatar_url: string | null } | null;
};

function Trades() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("all");

  const trades = useQuery({
    queryKey: ["my-trades", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TradeWithProfiles[]> => {
      const { data, error } = await supabase
        .from("trades")
        .select("id,status,created_at,requester_id,receiver_id,offered_stickers,requested_stickers,requester:profiles!trades_requester_profile_fkey(full_name,avatar_url),receiver:profiles!trades_receiver_profile_fkey(full_name,avatar_url)")
        .or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TradeWithProfiles[];
    },
  });

  const all = trades.data ?? [];
  const isClosed = (s: string) => s === "cancelled" || s === "declined";
  const counts = {
    all: all.length,
    pending: all.filter((t) => t.status === "pending").length,
    accepted: all.filter((t) => t.status === "accepted").length,
    completed: all.filter((t) => t.status === "completed").length,
    closed: all.filter((t) => isClosed(t.status)).length,
  };
  const awaitingMe = all.filter((t) => t.status === "pending" && t.receiver_id === user?.id).length;

  const filtered = all.filter((t) => {
    if (tab === "all") return true;
    if (tab === "closed") return isClosed(t.status);
    return t.status === tab;
  });

  const tabs: { k: Tab; label: string }[] = [
    { k: "all", label: "Todas" },
    { k: "pending", label: "Pendentes" },
    { k: "accepted", label: "Aceitas" },
    { k: "completed", label: "Concluídas" },
    { k: "closed", label: "Encerradas" },
  ];

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">Minhas Trocas</h1>
        {awaitingMe > 0 && (
          <span className="text-[11px] font-bold text-gold bg-gold/10 border border-gold/40 px-2 py-1 rounded-full whitespace-nowrap">
            {awaitingMe} aguarda{awaitingMe > 1 ? "m" : ""} você
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
        {tabs.map((t) => {
          const c = counts[t.k];
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                active ? "gradient-primary text-primary-foreground glow-primary" : "glass text-muted-foreground"
              }`}
            >
              <span>{t.label}</span>
              {c > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-primary-foreground/20" : "bg-surface"}`}>
                  {c}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 mt-4">
        {trades.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface rounded-2xl animate-pulse" />
          ))
        ) : trades.isError ? (
          <p className="text-center text-sm text-destructive py-10 glass rounded-2xl">
            Não foi possível carregar suas trocas. Verifique sua conexão e tente novamente.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10 glass rounded-2xl">
            Nenhuma troca aqui ainda.
            <br />
            <Link to="/near" className="text-primary font-bold mt-2 inline-block">
              Encontrar colecionadores →
            </Link>
          </p>
        ) : (
          filtered.map((t) => {
            const isMine = t.requester_id === user?.id;
            const other = isMine ? t.receiver : t.requester;
            const name = other?.full_name || "Colecionador";
            return (
              <Link
                key={t.id}
                to="/trade/$id"
                params={{ id: t.id }}
                className="glass rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground">
                  {other?.avatar_url ? (
                    <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    name[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isMine ? "Você enviou" : "Recebida"} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  {(t.offered_stickers.length > 0 || t.requested_stickers.length > 0) && (
                    <p className="text-[11px] text-primary font-semibold mt-0.5">
                      {t.offered_stickers.length > 0 && `${t.offered_stickers.length} oferecida${t.offered_stickers.length > 1 ? "s" : ""}`}
                      {t.offered_stickers.length > 0 && t.requested_stickers.length > 0 && " · "}
                      {t.requested_stickers.length > 0 && `${t.requested_stickers.length} pedida${t.requested_stickers.length > 1 ? "s" : ""}`}
                    </p>
                  )}
                </div>
                <StatusBadge status={t.status} />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "text-gold border-gold/40" },
    accepted: { label: "Aceita", cls: "text-primary border-primary/40" },
    declined: { label: "Recusada", cls: "text-destructive border-destructive/40" },
    completed: { label: "Concluída", cls: "text-primary border-primary/40" },
    cancelled: { label: "Cancelada", cls: "text-muted-foreground border-border" },
  };
  const m = labels[status] || labels.pending;
  return <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${m.cls}`}>{m.label}</span>;
}
