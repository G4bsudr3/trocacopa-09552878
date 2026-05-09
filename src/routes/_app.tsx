import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { Home, BookOpen, ScanLine, MapPin, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-display text-4xl text-primary text-glow animate-pulse">⚽</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
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
    <nav className="fixed bottom-0 inset-x-0 z-50 safe-bottom">
      <div className="mx-auto max-w-2xl px-3 pb-2">
        <div className="glass-strong rounded-3xl flex items-end justify-around px-2 py-2 shadow-card">
          {tabs.map(({ to, icon: Icon, label, center }) => {
            const active = loc.pathname.startsWith(to);
            if (center) {
              return (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center -mt-8"
                >
                  <span
                    className={`w-14 h-14 rounded-full flex items-center justify-center gradient-primary glow-primary border-4 border-background transition active:scale-95 ${active ? "animate-pulse-glow" : ""}`}
                  >
                    <Icon className="text-primary-foreground" size={26} strokeWidth={2.5} />
                  </span>
                  <span className="text-[10px] mt-1 font-semibold text-primary">{label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
