import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Crown, Repeat2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TOTAL_STICKERS } from "@/lib/stickers";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Início — TrocaCopa" }] }),
  component: Home,
});

function Home() {
  const { profile, user } = useAuth();
  const owned = profile?.album_progress ?? 0;
  const missing = TOTAL_STICKERS - owned;
  const pct = Math.round((owned / TOTAL_STICKERS) * 100);
  const name = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Colecionador";

  const dups = useQuery({
    queryKey: ["album-dups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_stickers").select("duplicates").eq("user_id", user!.id);
      return (data ?? []).reduce((a, r: any) => a + Math.max(0, r.duplicates - 1), 0);
    },
  });

  const unread = useUnreadNotifications();

  const featured = useQuery({
    queryKey: ["featured-match", user?.id, profile?.lat, profile?.lng, profile?.city],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("match_collectors", { _radius_km: 50 });
      return ((data ?? []) as any[]).slice(0, 5);
    },
  });

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-primary text-glow tracking-wide">⚽ TROCACOPA</h1>
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="relative w-10 h-10 rounded-full glass flex items-center justify-center">
            <Bell size={18} />
            {unread.total > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {unread.total > 99 ? "99+" : unread.total}
              </span>
            )}
          </Link>
          <Link to="/profile" className="w-10 h-10 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              name[0]?.toUpperCase()
            )}
          </Link>
        </div>
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-2xl">Oi, <span className="font-bold">{name}</span>! 👋</p>
        <p className="text-muted-foreground text-sm">Pronto para mais trocas hoje?</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-strong rounded-3xl p-6 mt-5 relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-gold/15 blur-3xl" />

        <div className="flex items-center gap-5 relative">
          <ProgressRing pct={pct} />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Seu álbum</p>
            <p className="font-display text-3xl">
              {pct}% completo <span className="text-2xl">🔥</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-gold font-semibold">{dups.data ?? 0}</span> repetidas · faltam <span className="text-primary font-semibold">{missing}</span>
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <ActionCard to="/scan" label="Escanear" emoji="📷" />
        <ActionCard to="/trades" label="Minhas Trocas" emoji="🔄" />
        <ActionCard to="/near" label="Perto de Mim" emoji="📍" />
        <ActionCard to="/album" label="Meu Álbum" emoji="📊" />
      </div>

      {(dups.data ?? 0) > 0 && (
        <Link to="/duplicates" className="block mt-5">
          <motion.div whileHover={{ scale: 1.01 }} className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-gold/30">
            <span className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center glow-gold">
              <Repeat2 className="text-gold-foreground" size={22} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm">Minhas Repetidas</p>
              <p className="text-xs text-muted-foreground">
                {dups.data} trocável{dups.data === 1 ? "" : "is"} pronta{dups.data === 1 ? "" : "s"} para troca
              </p>
            </div>
            <span className="text-gold font-display text-2xl">→</span>
          </motion.div>
        </Link>
      )}

      {profile?.plan !== "pro" && (
        <Link to="/pro" className="block mt-5">
          <motion.div whileHover={{ scale: 1.01 }} className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-gold/30">
            <span className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center text-xl glow-gold">
              <Crown className="text-gold-foreground" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm">🔒 Match automático e radar ilimitado</p>
              <p className="text-xs text-muted-foreground">Assine o TrocaCopa Pro</p>
            </div>
            <span className="text-gold font-display text-2xl">→</span>
          </motion.div>
        </Link>
      )}

      <section className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl tracking-wide">Trocas Disponíveis</h2>
          <Link to="/near" className="text-xs text-primary font-semibold">Ver todas →</Link>
        </div>
        {featured.isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="min-w-[220px] h-32 bg-surface rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (featured.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground glass rounded-2xl p-4 text-center">
            Ninguém por perto ainda.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-none">
            {(featured.data ?? []).map((c: any) => (
              <div key={c.id} className="min-w-[220px] glass rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (c.full_name?.[0] || "?").toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.full_name || "Colecionador"}</p>
                    <p className="text-xs text-muted-foreground">{c.city || "—"}{c.distance_km != null ? ` · ~${c.distance_km.toFixed(1)}km` : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className="font-display text-2xl text-primary text-glow">{c.score_pct ?? 0}</span>
                </div>
                <Link to="/near" className="mt-3 block w-full gradient-primary text-center text-primary-foreground rounded-full py-2 text-xs font-bold">
                  Ver
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.22 152)" />
            <stop offset="100%" stopColor="oklch(0.86 0.16 92)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} stroke="oklch(0.25 0.03 270)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="50" cy="50" r={r}
          stroke="url(#ring)" strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-2xl">
        {pct}%
      </div>
    </div>
  );
}

function ActionCard({ to, label, emoji }: { to: string; label: string; emoji: string }) {
  return (
    <Link to={to as any} className="glass rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition">
      <span className="text-2xl">{emoji}</span>
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
}
