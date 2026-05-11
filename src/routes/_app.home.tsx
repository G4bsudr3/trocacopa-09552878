import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Crown, Repeat2, ArrowRight, ScanLine, MapPin, BookOpen, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TOTAL_STICKERS } from "@/lib/stickers";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";
import { useTheme } from "@/lib/use-theme";
import logoBranca from "@/assets/logo-branca.png";
import logoPreta from "@/assets/logo-preta.png";

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Início — TrocaCopa" }] }),
  component: Home,
});

function Home() {
  const { profile, user } = useAuth();
  const owned = Math.max(0, Math.min(profile?.album_progress ?? 0, TOTAL_STICKERS));
  const missing = Math.max(0, TOTAL_STICKERS - owned);
  const pct = Math.max(0, Math.min(100, Math.round((owned / TOTAL_STICKERS) * 100)));
  const name = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Colecionador";
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const dups = useQuery({
    queryKey: ["album-dups", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_stickers").select("duplicates").eq("user_id", user!.id);
      return (data ?? []).reduce((a, r: any) => a + Math.max(0, r.duplicates - 1), 0);
    },
  });

  const unread = useUnreadNotifications();
  const { theme } = useTheme();

  const featured = useQuery({
    queryKey: ["featured-match", user?.id],
    enabled: !!user,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("match_collectors", { _radius_km: 50 });
      return ((data ?? []) as any[]).slice(0, 5);
    },
  });

  return (
    <div className="px-4 pt-4 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-5">
        <img
          src={theme === "dark" ? logoBranca : logoPreta}
          alt="TrocaCopa"
          className="h-8 object-contain"
        />
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            search={{ filter: "all" }}
            className="relative w-9 h-9 rounded-xl card flex items-center justify-center active:scale-95 transition"
            aria-label="Notificações"
          >
            <Bell size={16} />
            {unread.total > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {unread.total > 99 ? "99+" : unread.total}
              </span>
            )}
          </Link>
          <Link to="/profile" className="w-9 h-9 rounded-xl overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground text-sm shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              name[0]?.toUpperCase()
            )}
          </Link>
        </div>
      </header>

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <p className="text-xl font-semibold">{greeting}, {name} 👋</p>
        <p className="text-sm text-muted-foreground">Pronto para mais trocas hoje?</p>
      </motion.div>

      {/* Album progress */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card rounded-2xl p-5 flex items-center gap-4"
      >
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Seu álbum</p>
          <p className="font-display text-4xl leading-none">{pct}%</p>
          <p className="text-xs text-muted-foreground mt-2">
            {owned} figurinhas &middot; <span className="text-foreground font-semibold">{missing} faltando</span>
          </p>
          {(dups.data ?? 0) > 0 && (
            <p className="text-xs text-primary font-semibold mt-0.5">
              {dups.data} repetidas prontas pra troca
            </p>
          )}
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <ActionCard to="/scan" label="Escanear" icon={ScanLine} desc="Adicionar figurinhas" />
        <ActionCard to="/trades" label="Minhas Trocas" icon={Repeat2} desc="Ver negociações" />
        <ActionCard to="/near" label="Perto de Mim" icon={MapPin} desc="Encontrar trocadores" />
        <ActionCard to="/album" label="Meu Álbum" icon={BookOpen} desc="Ver coleção completa" />
      </div>

      {/* Duplicates CTA */}
      {(dups.data ?? 0) > 0 && (
        <Link to="/duplicates" className="block mt-4">
          <div className="card rounded-2xl p-4 flex items-center gap-3 border-l-2 border-l-primary active:scale-[0.98] transition">
            <span className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shrink-0">
              <Repeat2 className="text-primary-foreground" size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Minhas Repetidas</p>
              <p className="text-xs text-muted-foreground">
                {dups.data} trocável{dups.data === 1 ? "" : "is"} pronta{dups.data === 1 ? "" : "s"}
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* Pro CTA */}
      {profile?.plan !== "pro" && (
        <Link to="/pro" className="block mt-3">
          <div className="card rounded-2xl p-4 flex items-center gap-3 border-l-2 border-l-gold active:scale-[0.98] transition">
            <span className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center shrink-0">
              <Crown className="text-gold-foreground" size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">TrocaCopa Pro</p>
              <p className="text-xs text-muted-foreground">Match automático e radar ilimitado</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* Featured matches */}
      <section className="mt-6 pb-28 md:pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Combinações pra você</p>
          <Link to="/near" className="text-xs text-primary font-semibold flex items-center gap-1">
            Ver todas <ArrowRight size={12} />
          </Link>
        </div>

        {featured.isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="min-w-[200px] h-28 bg-surface rounded-2xl animate-pulse shrink-0" />
            ))}
          </div>
        ) : (featured.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground card rounded-2xl p-4 text-center">
            Ninguém por perto ainda.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            {(featured.data ?? []).map((c: any) => (
              <Link
                key={c.id}
                to="/near"
                className="min-w-[190px] card rounded-2xl p-3 shrink-0 active:scale-[0.97] transition"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground text-sm shrink-0">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (c.full_name?.[0] || "?").toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.full_name || "Colecionador"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.city || "—"}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                    <p className="font-display text-2xl text-primary leading-none">{c.score_pct ?? 0}<span className="text-sm">%</span></p>
                  </div>
                  {c.distance_km != null && (
                    <p className="text-[11px] text-muted-foreground">~{c.distance_km.toFixed(0)} km</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.22 152)" />
            <stop offset="100%" stopColor="oklch(0.86 0.16 92)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} stroke="oklch(0.22 0.02 270)" strokeWidth="6" fill="none" />
        <motion.circle
          cx="40" cy="40" r={r}
          stroke="url(#ring)" strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-xl leading-none">
        {pct}%
      </div>
    </div>
  );
}

function ActionCard({ to, label, icon: Icon, desc }: { to: string; label: string; icon: LucideIcon; desc: string }) {
  return (
    <Link to={to as any} className="card rounded-xl p-4 flex flex-col gap-1 active:scale-[0.97] transition">
      <span className="mb-1 text-primary"><Icon size={20} strokeWidth={2} /></span>
      <span className="font-semibold text-sm">{label}</span>
      <span className="text-[11px] text-muted-foreground leading-tight">{desc}</span>
    </Link>
  );
}
