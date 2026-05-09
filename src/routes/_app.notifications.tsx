import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell, Repeat, MessageCircle, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notificações — TrocaCopa" }] }),
  component: Notifs,
});

type Notif = {
  id: string;
  user_id: string;
  type: string;
  payload: { trade_id?: string; from?: string; preview?: string };
  read: boolean;
  created_at: string;
};

function iconFor(type: string) {
  if (type.startsWith("trade_message")) return <MessageCircle size={20} className="text-primary" />;
  if (type === "trade_request") return <Repeat size={20} className="text-gold" />;
  if (type === "trade_accepted" || type === "trade_completed") return <CheckCircle2 size={20} className="text-primary" />;
  if (type === "trade_declined" || type === "trade_cancelled") return <X size={20} className="text-destructive" />;
  return <Bell size={20} />;
}

function labelFor(n: Notif) {
  switch (n.type) {
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

  const notifs = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const items = notifs.data ?? [];

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Notificações</h1>
        <button onClick={markAllRead} className="text-xs text-primary font-semibold">
          Marcar como lidas
        </button>
      </div>

      {notifs.isLoading ? (
        <div className="space-y-2 mt-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10 mt-5 glass rounded-2xl">
          Nenhuma notificação ainda.
        </p>
      ) : (
        <div className="space-y-2 mt-5">
          {items.map((n) => {
            const inner = (
              <div className={`glass rounded-2xl p-4 flex items-center gap-3 ${!n.read ? "border border-primary/30" : ""}`}>
                <span className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                  {iconFor(n.type)}
                </span>
                <div className="flex-1">
                  <p className="text-sm">{labelFor(n)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
              </div>
            );
            return n.payload.trade_id ? (
              <Link key={n.id} to="/trade/$id" params={{ id: n.payload.trade_id }}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
