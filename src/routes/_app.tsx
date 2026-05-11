import { createFileRoute, Outlet, Link, useLocation, Navigate, useNavigate } from "@tanstack/react-router";
import { Home, BookOpen, ScanLine, MapPin, User, Bell } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/use-theme";
import logoBranca from "@/assets/logo-branca.png";
import logoPreta from "@/assets/logo-preta.png";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";
import { AgeGate } from "@/components/AgeGate";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, user, profile } = useAuth();
  const nav = useNavigate();
  const { theme } = useTheme();
  const lastToastRef = useRef(0);
  const prefsRef = useRef(profile?.notification_prefs);
  prefsRef.current = profile?.notification_prefs;

  useEffect(() => {
    if (!user) return;
    const name = `notif-toast-${user.id}`;
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${name}` || c.topic === name) supabase.removeChannel(c);
    });
    const ch = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => {
          const n = p.new as { type: string; payload: { trade_id?: string; score?: number; city?: string; preview?: string } };
          const prefs = (prefsRef.current as { trades?: boolean; messages?: boolean; matches?: boolean } | null) ?? {};
          if (n.type === "trade_message" && prefs.messages === false) return;
          if (n.type === "match_high" && prefs.matches === false) return;
          if (n.type.startsWith("trade_") && n.type !== "trade_message" && prefs.trades === false) return;
          if (Date.now() - lastToastRef.current < 1000) return;
          lastToastRef.current = Date.now();

          let title = "Nova notificação";
          let action: { label: string; onClick: () => void } | undefined;
          if (n.type === "match_high") {
            title = `⚡ Match ${n.payload.score ?? ""}%${n.payload.city ? ` em ${n.payload.city}` : ""}`;
            action = { label: "Ver", onClick: () => nav({ to: "/near" }) };
          } else if (n.type === "trade_request") {
            title = "📨 Novo pedido de troca";
            if (n.payload.trade_id) action = { label: "Abrir", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          } else if (n.type === "trade_accepted") {
            title = "✅ Sua troca foi aceita!";
            if (n.payload.trade_id) action = { label: "Abrir", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          } else if (n.type === "trade_declined") {
            title = "❌ Sua troca foi recusada";
            if (n.payload.trade_id) action = { label: "Ver", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          }
          else if (n.type === "trade_completed") {
            title = "🎉 Troca concluída!";
            if (n.payload.trade_id) action = { label: "Ver", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          } else if (n.type === "trade_cancelled") {
            title = "Troca cancelada";
            if (n.payload.trade_id) action = { label: "Ver", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          }
          else if (n.type === "trade_message") {
            title = n.payload.preview ? `💬 ${n.payload.preview}` : "Nova mensagem";
            if (n.payload.trade_id) action = { label: "Abrir", onClick: () => nav({ to: "/trade/$id", params: { id: n.payload.trade_id! } }) };
          }
          else if (n.type === "trade_meet") {
            title = "📅 Encontro de troca atualizado";
            const tid = (n.payload as { trade_id?: string }).trade_id;
            if (tid) action = { label: "Ver", onClick: () => nav({ to: "/trade/$id", params: { id: tid } }) };
          }
          else if (n.type === "friend_added") title = `🤝 ${(n.payload as { name?: string }).name ?? "Novo amigo"} virou seu amigo`;

          toast(title, action ? { action } : undefined);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, nav]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <img
          src={theme === "dark" ? logoBranca : logoPreta}
          alt="TrocaCopa"
          className="h-16 object-contain animate-pulse"
        />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="hidden md:flex h-12 items-center justify-between border-b border-border/50 px-3 sticky top-0 z-30 bg-background/80 backdrop-blur">
            <SidebarTrigger />
            <NotificationBell inline />
          </header>
          <NotificationBell />
          <main className="flex-1 pb-24 md:pb-6">
            <Outlet />
          </main>
          <BottomNav />
        </div>
        <AgeGate />
      </div>
    </SidebarProvider>
  );
}

function NotificationBell({ inline = false }: { inline?: boolean }) {
  const loc = useLocation();
  const { total, top } = useUnreadNotifications();
  if (loc.pathname.startsWith("/notifications")) return null;
  const ringColor =
    top === "matches" ? "bg-gold text-gold-foreground"
    : top === "messages" ? "bg-accent text-accent-foreground"
    : "bg-primary text-primary-foreground";
  const base = inline
    ? "relative w-10 h-10 rounded-full glass flex items-center justify-center active:scale-95 transition"
    : "md:hidden fixed top-3 right-3 z-50 w-11 h-11 rounded-full glass-strong flex items-center justify-center active:scale-95 transition shadow-card";
  return (
    <Link
      to="/notifications"
      search={{ filter: "all" }}
      aria-label={`Notificações${total > 0 ? ` (${total} não lidas)` : ""}`}
      className={base}
    >
      <Bell size={18} />
      {total > 0 && (
        <span
          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${ringColor} ring-2 ring-background`}
        >
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}

type Tab = { to: string; icon: typeof Home; label: string; center?: boolean };
const tabs: Tab[] = [
  { to: "/home", icon: Home, label: "Início" },
  { to: "/album", icon: BookOpen, label: "Álbum" },
  { to: "/scan", icon: ScanLine, label: "Escanear", center: true },
  { to: "/near", icon: MapPin, label: "Perto" },
  { to: "/profile", icon: User, label: "Perfil" },
];

function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 safe-bottom">
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <div className="card rounded-2xl flex items-center justify-around px-2 py-2 shadow-card">
          {tabs.map(({ to, icon: Icon, label, center }) => {
            const active = loc.pathname.startsWith(to);
            if (center) {
              return (
                <Link
                  key={to}
                  to={to as any}
                  className="flex flex-col items-center -mt-5"
                >
                  <span
                    className={`w-11 h-11 rounded-xl gradient-primary flex items-center justify-center transition active:scale-95${active ? " glow-primary" : ""}`}
                  >
                    <Icon className="text-primary-foreground" size={20} strokeWidth={2.2} />
                  </span>
                  <span className={`text-[10px] mt-1 font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={to}
                to={to as any}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-bold">{label}</span>
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
