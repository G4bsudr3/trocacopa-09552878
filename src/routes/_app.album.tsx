import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Lock, Check, Plus, Minus, X, RotateCcw, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAlbum, type Sticker } from "@/lib/use-album";
import { GROUP_LETTERS, groupByCountry } from "@/lib/stickers";

export const Route = createFileRoute("/_app/album")({
  head: () => ({ meta: [{ title: "Meu Álbum — TrocaCopa" }] }),
  component: Album,
});

type Tab = "selecoes" | "history" | "coca";
type Filter = "all" | "owned" | "missing" | "dup";

function Album() {
  const { stickers, total, toggleOwned, addDuplicate, removeDuplicate, reset, isLoading } = useAlbum();
  const [tab, setTab] = useState<Tab>("selecoes");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Sticker | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>("A");

  const owned = stickers.filter((s) => s.owned).length;
  const dups = stickers.filter((s) => s.duplicates > 1).length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

  const passFilter = (s: Sticker) => {
    if (filter === "owned" && !s.owned) return false;
    if (filter === "missing" && s.owned) return false;
    if (filter === "dup" && s.duplicates < 2) return false;
    if (q && !`${s.code} ${s.country_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  };

  const cover = useMemo(() => stickers.find((s) => s.kind === "cover") ?? null, [stickers]);
  const countries = useMemo(
    () => stickers.filter((s) => s.kind === "country" && passFilter(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickers, filter, q],
  );
  const fwc = useMemo(
    () => stickers.filter((s) => s.kind === "history" && passFilter(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickers, filter, q],
  );
  const coca = useMemo(
    () => stickers.filter((s) => s.kind === "special" && passFilter(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickers, filter, q],
  );

  const current = selected ? stickers.find((s) => s.code === selected.code) ?? selected : null;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "owned", label: "Tenho" },
    { key: "missing", label: "Faltam" },
    { key: "dup", label: "Repetidas" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "selecoes", label: "Seleções" },
    { key: "history", label: "História FWC" },
    { key: "coca", label: "Coca-Cola" },
  ];

  const onCellTap = (s: Sticker) => {
    toggleOwned(s.code);
    toast.success(s.owned ? `${s.code} desmarcada` : `${s.code} adicionada!`);
  };

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Meu Álbum</h1>
        <button
          onClick={() => {
            if (confirm("Tem certeza que deseja resetar todo o álbum?")) {
              reset();
              toast.success("Álbum reiniciado");
            }
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

      {/* Tabs */}
      <div className="flex gap-2 mt-4 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
              tab === t.key
                ? "gradient-primary text-primary-foreground glow-primary"
                : "glass text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-3 border border-transparent focus-within:border-primary">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código (BRA10) ou país..."
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

      {isLoading && (
        <div className="grid grid-cols-5 gap-2 mt-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && tab === "selecoes" && (
        <div className="mt-4 space-y-4">
          {cover && passFilter(cover) && (
            <section>
              <h2 className="font-display text-sm tracking-wider text-muted-foreground uppercase mb-2">
                Capa do álbum
              </h2>
              <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
                <StickerCell s={cover} onTap={() => onCellTap(cover)} onLong={() => setSelected(cover)} />
              </div>
            </section>
          )}

          {GROUP_LETTERS.map((g) => {
            const groupCountries = groupByCountry(countries.filter((s) => s.group_letter === g));
            if (groupCountries.length === 0) return null;
            const isOpen = openGroup === g;
            const totalInGroup = groupCountries.reduce((acc, c) => acc + c.stickers.length, 0);
            const ownedInGroup = groupCountries.reduce(
              (acc, c) => acc + c.stickers.filter((s) => (s as Sticker).owned).length,
              0,
            );
            return (
              <section key={g}>
                <button
                  onClick={() => setOpenGroup(isOpen ? null : g)}
                  className="w-full glass rounded-2xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl gradient-primary text-primary-foreground font-display text-lg flex items-center justify-center glow-primary">
                      {g}
                    </span>
                    <div className="text-left">
                      <p className="font-display text-base tracking-wide">Grupo {g}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ownedInGroup}/{totalInGroup} figurinhas
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-3">
                        {groupCountries.map((c) => {
                          const countryOwned = c.stickers.filter((s) => (s as Sticker).owned).length;
                          return (
                            <div key={c.country_code} className="glass rounded-2xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xl shrink-0">{c.flag_emoji}</span>
                                  <p className="font-semibold text-sm truncate">
                                    {c.country_name}{" "}
                                    <span className="text-muted-foreground font-normal">
                                      · {c.country_code}
                                    </span>
                                  </p>
                                </div>
                                <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                                  {countryOwned}/{c.stickers.length}
                                </span>
                              </div>
                              <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5">
                                {c.stickers.map((s) => (
                                  <StickerCell
                                    key={s.code}
                                    s={s as Sticker}
                                    onTap={() => onCellTap(s as Sticker)}
                                    onLong={() => setSelected(s as Sticker)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}

          {countries.length === 0 && !cover && (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhuma figurinha encontrada
            </p>
          )}
        </div>
      )}

      {!isLoading && tab === "history" && (
        <section className="mt-4 glass rounded-2xl p-4">
          <p className="font-display text-base tracking-wide flex items-center gap-2 mb-3">
            🏆 FIFA World Cup History
            <span className="text-xs text-muted-foreground font-normal">
              {fwc.filter((s) => s.owned).length}/19
            </span>
          </p>
          <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
            {fwc.map((s) => (
              <StickerCell key={s.code} s={s} onTap={() => onCellTap(s)} onLong={() => setSelected(s)} />
            ))}
          </div>
          {fwc.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Nada por aqui</p>
          )}
        </section>
      )}

      {!isLoading && tab === "coca" && (
        <section className="mt-4 rounded-2xl p-4 border border-[#dc2626]/40 bg-[#dc2626]/10">
          <p className="font-display text-base tracking-wide flex items-center gap-2 mb-3 text-[#fca5a5]">
            🥤 Coca-Cola
            <span className="text-xs text-muted-foreground font-normal">
              {coca.filter((s) => s.owned).length}/14
            </span>
          </p>
          <div className="grid grid-cols-5 md:grid-cols-7 gap-2">
            {coca.map((s) => (
              <StickerCell key={s.code} s={s} onTap={() => onCellTap(s)} onLong={() => setSelected(s)} />
            ))}
          </div>
          {coca.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Nada por aqui</p>
          )}
        </section>
      )}

      <p className="text-[11px] text-muted-foreground mt-4 text-center">
        Toque para marcar/desmarcar · Toque longo para ajustar repetidas
      </p>

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
                  className={`w-20 h-28 rounded-2xl flex flex-col items-center justify-center font-display ${
                    current.owned
                      ? "gradient-primary text-primary-foreground glow-primary"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  <span className="text-3xl leading-none">{current.flag_emoji}</span>
                  <span className="text-sm mt-1">{current.code}</span>
                </div>
                <div>
                  <p className="font-display text-2xl">{current.country_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {current.kind === "country"
                      ? `Grupo ${current.group_letter}`
                      : current.kind === "history"
                        ? "FIFA World Cup History"
                        : current.kind === "special"
                          ? "Coca-Cola"
                          : "Capa do álbum"}
                  </p>
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
                    toggleOwned(current.code);
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
                      onClick={() => removeDuplicate(current.code)}
                      disabled={current.duplicates === 0}
                      className="w-9 h-9 rounded-full bg-surface flex items-center justify-center disabled:opacity-30 active:scale-95"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-display text-2xl text-gold w-8 text-center">
                      {current.duplicates}
                    </span>
                    <button
                      onClick={() => addDuplicate(current.code)}
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
      className={`aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center p-1 relative overflow-hidden select-none ${
        s.owned
          ? "glass border border-primary/40 glow-primary"
          : "bg-surface border border-border/50 opacity-60"
      }`}
    >
      {s.duplicates > 1 && (
        <span className="absolute top-0.5 right-0.5 z-10 bg-gold text-gold-foreground text-[8px] font-bold px-1 py-0.5 rounded-full">
          {s.duplicates}x
        </span>
      )}
      {!s.owned && <Lock size={10} className="absolute top-0.5 right-0.5 text-muted-foreground" />}
      {s.owned && s.duplicates < 2 && (
        <Check size={10} className="absolute top-0.5 right-0.5 text-primary" />
      )}
      <span className="text-base leading-none">{s.flag_emoji}</span>
      <span
        className={`font-display text-[10px] leading-none mt-1 ${
          s.owned ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {s.code}
      </span>
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
