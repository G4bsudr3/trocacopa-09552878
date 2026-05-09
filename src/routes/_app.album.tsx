import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Lock, Check } from "lucide-react";
import { generateStickers, TOTAL_STICKERS } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/album")({
  head: () => ({ meta: [{ title: "Meu Álbum — TrocaCopa" }] }),
  component: Album,
});

type Filter = "all" | "owned" | "missing" | "dup";

function Album() {
  const stickers = useMemo(() => generateStickers(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const owned = stickers.filter((s) => s.owned).length;
  const dups = stickers.filter((s) => s.duplicates > 1).length;
  const pct = Math.round((owned / TOTAL_STICKERS) * 100);

  const filtered = stickers.filter((s) => {
    if (filter === "owned" && !s.owned) return false;
    if (filter === "missing" && s.owned) return false;
    if (filter === "dup" && s.duplicates < 2) return false;
    if (q && !`${s.number} ${s.name} ${s.team}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "owned", label: "Tenho" },
    { key: "missing", label: "Faltam" },
    { key: "dup", label: "Repetidas" },
  ];

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Meu Álbum</h1>

      {/* Hero */}
      <div className="glass-strong rounded-3xl p-5 mt-4 grid grid-cols-3 gap-4 items-center">
        <div className="col-span-1">
          <Ring pct={pct} />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <Stat label="Tenho" value={owned} color="text-primary" />
          <Stat label="Repetidas" value={dups} color="text-gold" />
          <Stat label="Faltam" value={TOTAL_STICKERS - owned} color="text-muted-foreground" />
          <Stat label="Total" value={TOTAL_STICKERS} color="text-foreground" />
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-5 border border-transparent focus-within:border-primary">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número ou nome..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mt-3 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
              filter === f.key
                ? "gradient-primary text-primary-foreground glow-primary"
                : "glass text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-4">
        {filtered.map((s) => (
          <motion.div
            key={s.number}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`aspect-[3/4] rounded-xl flex flex-col items-center justify-center text-center p-1 relative overflow-hidden ${
              s.owned
                ? "glass border border-primary/40 glow-primary"
                : "bg-surface border border-border/50 opacity-60"
            }`}
          >
            {s.duplicates > 1 && (
              <span className="absolute top-1 right-1 z-10 bg-gold text-gold-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {s.duplicates}x
              </span>
            )}
            {!s.owned && (
              <Lock size={14} className="absolute top-1 right-1 text-muted-foreground" />
            )}
            {s.owned && s.duplicates < 2 && (
              <Check size={12} className="absolute top-1 right-1 text-primary" />
            )}
            <span className={`font-display text-lg leading-none ${s.owned ? "text-primary" : "text-muted-foreground"}`}>
              #{s.number}
            </span>
            <span className="text-[8px] text-muted-foreground mt-1 truncate w-full px-1">{s.team}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className={`font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
        <defs>
          <linearGradient id="ring2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.22 152)" />
            <stop offset="100%" stopColor="oklch(0.86 0.16 92)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} stroke="oklch(0.25 0.03 270)" strokeWidth="9" fill="none" />
        <motion.circle cx="50" cy="50" r={r} stroke="url(#ring2)" strokeWidth="9" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ duration: 1.2 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-2xl">{pct}%</div>
    </div>
  );
}
