import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Lock, Check, Plus, Minus, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAlbum, type Sticker } from "@/lib/use-album";

export const Route = createFileRoute("/_app/album")({
  head: () => ({ meta: [{ title: "Meu Álbum — TrocaCopa" }] }),
  component: Album,
});

type Filter = "all" | "owned" | "missing" | "dup";

function Album() {
  const { stickers, total, toggleOwned, addDuplicate, removeDuplicate, reset, isLoading } = useAlbum();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Sticker | null>(null);

  const owned = stickers.filter((s) => s.owned).length;
  const dups = stickers.filter((s) => s.duplicates > 1).length;
  const pct = Math.round((owned / total) * 100);

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

  const current = selected ? stickers.find((s) => s.number === selected.number) ?? selected : null;

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Meu Álbum</h1>
        <button
          onClick={() => {
            reset();
            toast.success("Álbum reiniciado");
          }}
          className="text-xs text-muted-foreground flex items-center gap-1 px-3 py-1.5 rounded-full glass"
        >
          <RotateCcw size={12} /> Resetar
        </button>
      </div>

      {/* Hero */}
      <div className="glass-strong rounded-3xl p-5 mt-4 grid grid-cols-3 gap-4 items-center">
        <div className="col-span-1">
          <Ring pct={pct} />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <Stat label="Tenho" value={owned} color="text-primary" />
          <Stat label="Repetidas" value={dups} color="text-gold" />
          <Stat label="Faltam" value={total - owned} color="text-muted-foreground" />
          <Stat label="Total" value={total} color="text-foreground" />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Toque em uma figurinha para marcar/desmarcar · Toque longo para ajustar repetidas
      </p>

      {/* Search */}
      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-4 border border-transparent focus-within:border-primary">
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
          <StickerCell
            key={s.number}
            s={s}
            onTap={() => {
              toggleOwned(s.number);
              toast.success(s.owned ? `#${s.number} desmarcada` : `#${s.number} adicionada!`);
            }}
            onLong={() => setSelected(s)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-10">
            Nenhuma figurinha encontrada
          </p>
        )}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {current && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", damping: 28 }}
              className="relative glass-strong rounded-t-3xl w-full max-w-md p-6 pb-10 safe-bottom"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full glass flex items-center justify-center"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-4">
                <div
                  className={`w-20 h-28 rounded-2xl flex flex-col items-center justify-center ${
                    current.owned ? "gradient-primary glow-primary" : "bg-surface"
                  }`}
                >
                  <span className={`font-display text-3xl ${current.owned ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    #{current.number}
                  </span>
                </div>
                <div>
                  <p className="font-display text-2xl">{current.name}</p>
                  <p className="text-sm text-muted-foreground">{current.team} · Grupo {current.group_letter}</p>
                  <p className="text-xs mt-1">
                    {current.owned ? (
                      <span className="text-primary font-bold">
                        Você tem {current.duplicates > 1 ? `${current.duplicates}x` : "1"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Faltando no álbum</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => {
                    toggleOwned(current.number);
                    toast.success(current.owned ? "Removida do álbum" : "Adicionada ao álbum!");
                  }}
                  className={`w-full py-3.5 rounded-full font-bold transition active:scale-95 ${
                    current.owned
                      ? "glass text-foreground border border-border"
                      : "gradient-primary text-primary-foreground glow-primary"
                  }`}
                >
                  {current.owned ? "Remover do álbum" : "Tenho essa!"}
                </button>

                <div className="flex items-center justify-between glass rounded-full px-4 py-3">
                  <span className="text-sm font-semibold">Repetidas</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => removeDuplicate(current.number)}
                      disabled={current.duplicates === 0}
                      className="w-9 h-9 rounded-full bg-surface flex items-center justify-center disabled:opacity-30 active:scale-95"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-display text-2xl text-gold w-8 text-center">
                      {current.duplicates}
                    </span>
                    <button
                      onClick={() => addDuplicate(current.number)}
                      className="w-9 h-9 rounded-full bg-gold text-gold-foreground flex items-center justify-center active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StickerCell({
  s,
  onTap,
  onLong,
}: {
  s: Sticker;
  onTap: () => void;
  onLong: () => void;
}) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longFired = false;

  const start = () => {
    longFired = false;
    pressTimer = setTimeout(() => {
      longFired = true;
      onLong();
    }, 400);
  };
  const end = () => {
    if (pressTimer) clearTimeout(pressTimer);
    if (!longFired) onTap();
  };
  const cancel = () => {
    if (pressTimer) clearTimeout(pressTimer);
    longFired = true;
  };

  return (
    <motion.button
      type="button"
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        onLong();
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.94 }}
      className={`aspect-[3/4] rounded-xl flex flex-col items-center justify-center text-center p-1 relative overflow-hidden select-none ${
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
      {!s.owned && <Lock size={14} className="absolute top-1 right-1 text-muted-foreground" />}
      {s.owned && s.duplicates < 2 && (
        <Check size={12} className="absolute top-1 right-1 text-primary" />
      )}
      <span
        className={`font-display text-lg leading-none ${
          s.owned ? "text-primary" : "text-muted-foreground"
        }`}
      >
        #{s.number}
      </span>
      <span className="text-[8px] text-muted-foreground mt-1 truncate w-full px-1">{s.team}</span>
    </motion.button>
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
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          stroke="url(#ring2)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-2xl">{pct}%</div>
    </div>
  );
}
