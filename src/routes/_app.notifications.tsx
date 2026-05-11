import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Bell, Repeat, MessageCircle, CheckCircle2, X, Trash2, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";

const FILTERS = ["all", "trades", "messages", "matches"] as const;
type Filter = (typeof FILTERS)[number];

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notificações — TrocaCopa" }] }),
  validateSearch: (s: Record<string, unknown>): { filter: Filter } => {
    const f = s.filter;
    return { filter: FILTERS.includes(f as Filter) ? (f as Filter) : "all" };
  },
  component: Notifs,
});

type Notif = {
  id: string;
  user_id: string;
  type: string;
  payload: { trade_id?: string; from?: string; preview?: string; other_id?: string; score?: number; city?: string };
  read: boolean;
  created_at: string;
};



function iconFor(type: string) {
  if (type === "match_high") return <Sparkles size={20} className="text-gold" />;
  if (type.startsWith("trade_message")) return <MessageCircle size={20} className="text-primary" />;
  if (type === "trade_request") return <Repeat size={20} className="text-gold" />;
  if (type === "trade_accepted" || type === "trade_completed") return <CheckCircle2 size={20} className="text-primary" />;
  if (type === "trade_declined" || type === "trade_cancelled") return <X size={20} className="text-destructive" />;
  return <Bell size={20} />;
}

function labelFor(n: Notif) {
  switch (n.type) {
    case "match_high": return `⚡ Novo match: ${n.payload.score ?? "?"}% de compatibilidade${n.payload.city ? ` em ${n.payload.city}` : ""}`;
    case "trade_request": return "Você recebeu um pedido de troca";
    case "trade_accepted": return "Sua troca foi aceita!";
    case "trade_declined": return "Sua troca foi recusada";
    case "trade_completed": return "Troca concluída 🎉";
    case "trade_cancelled": return "Troca cancelada";
    case "trade_message": return n.payload.preview ? `💬 ${n.payload.preview}` : "Nova mensagem";
    default: return n.type;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Notifs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { filter } = Route.useSearch();
  const navigate = useNavigate({ from: "/notifications" });
  const unread = useUnreadNotifications();
  const setFilter = (f: Filter) =>
    navigate({ search: { filter: f } });

  const notifs = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
    qc.invalidateQueries({ queryKey: ["unread", user!.id] });
  };

  const markAllRead = async () => {
    if (!user) return;
    // optimistic: mark all as read locally immediately
    qc.setQueryData<Notif[]>(["notifications", user.id], (old) =>
      (old ?? []).map((n) => ({ ...n, read: true }))
    );
    qc.invalidateQueries({ queryKey: ["unread", user.id] });
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (error) { toast.error(error.message); invalidate(); }
  };

  const markRead = async (id: string) => {
    // optimistic: mark this one as read
    qc.setQueryData<Notif[]>(["notifications", user!.id], (old) =>
      (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    qc.invalidateQueries({ queryKey: ["unread", user!.id] });
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) { toast.error(error.message); invalidate(); }
  };

  const removeOne = async (id: string) => {
    // optimistic: remove from list immediately
    qc.setQueryData<Notif[]>(["notifications", user!.id], (old) =>
      (old ?? []).filter((n) => n.id !== id)
    );
    qc.invalidateQueries({ queryKey: ["unread", user!.id] });
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) { toast.error(error.message); invalidate(); }
  };

  const removeAll = async () => {
    if (!user) return;
    if (!confirm("Apagar todas as notificações?")) return;
    // optimistic: clear list immediately
    qc.setQueryData<Notif[]>(["notifications", user.id], []);
    qc.invalidateQueries({ queryKey: ["unread", user.id] });
    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
    if (error) { toast.error(error.message); invalidate(); }
  };

  const all = notifs.data ?? [];
  const items = all.filter((n) =>
    filter === "all"
      ? true
      : filter === "messages"
      ? n.type === "trade_message"
      : filter === "matches"
      ? n.type === "match_high"
      : n.type.startsWith("trade_") && n.type !== "trade_message"
  );

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl tracking-wide">Notificações</h1>
        <div className="flex items-center gap-3">
          <button onClick={markAllRead} className="text-xs text-primary font-semibold">Marcar lidas</button>
          {all.length > 0 && (
            <button onClick={removeAll} className="text-xs text-destructive font-semibold flex items-center gap-1">
              <Trash2 size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-none">
        {([
          ["all", "Todas", unread.total],
          ["matches", "Matches", unread.byCategory.matches],
          ["trades", "Trocas", unread.byCategory.trades],
          ["messages", "Mensagens", unread.byCategory.messages],
        ] as const).map(([k, l, n]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${filter === k ? "bg-primary text-primary-foreground" : "glass"}`}
          >
            {l}
            {n > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${filter === k ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground"}`}>
                {n > 99 ? "99+" : n}
              </span>
            )}
          </button>
        ))}
      </div>

      {notifs.isLoading ? (
        <div className="space-y-2 mt-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 mt-5 glass rounded-2xl px-5">
          <Bell size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          <Link to="/near" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-primary">
            <MapPin size={12} /> Encontrar colecionadores perto
          </Link>
        </div>
      ) : (
        <div className="space-y-2 mt-5">
          {items.map((n) => {
            const inner = (
              <div className={`glass rounded-2xl p-4 flex items-center gap-3 ${!n.read ? "border border-primary/30" : ""}`}>
                <span className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shrink-0">
                  {iconFor(n.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{labelFor(n)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeOne(n.id); }}
                  className="w-8 h-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center shrink-0"
                  aria-label="Apagar"
                >
                  <X size={14} />
                </button>
              </div>
            );
            if (n.type === "match_high") {
              return (
                <Link key={n.id} to="/near" onClick={() => !n.read && markRead(n.id)}>
                  {inner}
                </Link>
              );
            }
            return n.payload.trade_id ? (
              <Link
                key={n.id}
                to="/trade/$id"
                params={{ id: n.payload.trade_id }}
                onClick={() => !n.read && markRead(n.id)}
              >
                {inner}
              </Link>
            ) : (
              <button key={n.id} onClick={() => !n.read && markRead(n.id)} className="w-full text-left">{inner}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
