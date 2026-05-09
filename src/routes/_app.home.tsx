import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bell, Camera, Repeat, MapPin, BarChart3, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { generateStickers, mockCollectors, TOTAL_STICKERS } from "@/lib/mock-data";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/home")({
  head: () => ({ meta: [{ title: "Início — TrocaCopa" }] }),
  component: Home,
});

function Home() {
  const { profile, user } = useAuth();
  const stickers = useMemo(() => generateStickers(), []);
  const owned = stickers.filter((s) => s.owned).length;
  const dups = stickers.reduce((a, s) => a + (s.duplicates > 1 ? s.duplicates - 1 : 0), 0);
  const missing = TOTAL_STICKERS - owned;
  const pct = Math.round((owned / TOTAL_STICKERS) * 100);
  const name = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Colecionador";

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      {/* Top bar */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-primary text-glow tracking-wide">⚽ TROCACOPA</h1>
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="relative w-10 h-10 rounded-full glass flex items-center justify-center">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </Link>
          <Link to="/profile" className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground">
            {name[0]?.toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-2xl">Oi, <span className="font-bold">{name}</span>! 👋</p>
        <p className="text-muted-foreground text-sm">Pronto para mais trocas hoje?</p>
      </motion.div>

      {/* Hero progress */}
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
              <span className="text-gold font-semibold">{dups}</span> repetidas · faltam <span className="text-primary font-semibold">{missing}</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <ActionCard to="/scan" icon={<Camera />} label="Escanear" emoji="📷" />
        <ActionCard to="/trades" icon={<Repeat />} label="Minhas Trocas" emoji="🔄" />
        <ActionCard to="/near" icon={<MapPin />} label="Perto de Mim" emoji="📍" />
        <ActionCard to="/album" icon={<BarChart3 />} label="Meu Álbum" emoji="📊" />
      </div>

      {/* Pro banner */}
      {profile?.plan !== "pro" && (
        <Link to="/pro" className="block mt-5">
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-gold/30"
          >
            <span className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center text-xl glow-gold">
              <Crown className="text-gold-foreground" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm">🔒 Veja quem tem a figurinha #347</p>
              <p className="text-xs text-muted-foreground">Assine o TrocaCopa Pro</p>
            </div>
            <span className="text-gold font-display text-2xl">→</span>
          </motion.div>
        </Link>
      )}

      {/* Feed */}
      <section className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl tracking-wide">Trocas Disponíveis</h2>
          <Link to="/near" className="text-xs text-primary font-semibold">Ver todas →</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-none">
          {mockCollectors.map((c) => (
            <div key={c.id} className="min-w-[220px] glass rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground">
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.city} · ~{c.distanceKm}km</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Compatibilidade</span>
                <span className="font-display text-2xl text-primary text-glow">{c.match}%</span>
              </div>
              <Link to="/trade/$id" params={{ id: c.id }} className="mt-3 block w-full gradient-primary text-center text-primary-foreground rounded-full py-2 text-xs font-bold">
                Iniciar Troca
              </Link>
            </div>
          ))}
        </div>
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

function ActionCard({ to, icon, label, emoji }: { to: string; icon: React.ReactNode; label: string; emoji: string }) {
  return (
    <Link to={to as any} className="glass rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition">
      <span className="text-2xl">{emoji}</span>
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
}
