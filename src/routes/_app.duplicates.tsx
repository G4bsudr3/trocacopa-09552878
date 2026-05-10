import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, Repeat2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAlbum, type Sticker } from "@/lib/use-album";
import { groupByCountry } from "@/lib/stickers";

export const Route = createFileRoute("/_app/duplicates")({
  head: () => ({ meta: [{ title: "Minhas Repetidas — TrocaCopa" }] }),
  component: Duplicates,
});

type View = "country" | "grid";

function Duplicates() {
  const { stickers, addDuplicate, removeDuplicate, isLoading } = useAlbum();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("country");

  const dupAll = useMemo(() => stickers.filter((s) => s.duplicates > 1), [stickers]);

  const filtered = useMemo(() => {
    if (!q) return dupAll;
    const t = q.toLowerCase();
    return dupAll.filter((s) => `${s.code} ${s.country_name}`.toLowerCase().includes(t));
  }, [dupAll, q]);

  const totalExtras = dupAll.reduce((acc, s) => acc + (s.duplicates - 1), 0);
  const countries = new Set(dupAll.filter((s) => s.kind !== "special").map((s) => s.country_code)).size;

  const grouped = useMemo(() => groupByCountry(filtered.filter((s) => s.kind !== "special")), [filtered]);
  const specials = useMemo(() => filtered.filter((s) => s.kind === "special"), [filtered]);

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/album"
            className="w-9 h-9 rounded-full glass flex items-center justify-center shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-wide leading-tight">Minhas Repetidas</h1>
            <p className="text-[11px] text-muted-foreground">
              {dupAll.length} figurinhas · {totalExtras} trocáveis
            </p>
          </div>
        </div>
        <span className="w-10 h-10 rounded-full gradient-primary glow-primary flex items-center justify-center text-primary-foreground">
          <Repeat2 size={18} />
        </span>
      </div>

      {/* Hero stats */}
      <div className="glass-strong rounded-3xl p-4 mt-4 grid grid-cols-3 gap-2">
        <Stat label="Únicas" value={dupAll.length} color="text-primary" />
        <Stat label="Trocáveis" value={totalExtras} color="text-gold" />
        <Stat label="Países" value={countries} color="text-foreground" />
      </div>

      {dupAll.length > 0 && (
        <>
          {/* Search */}
          <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-4 border border-transparent focus-within:border-primary">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar repetida..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          {/* View toggle */}
          <div className="flex gap-2 mt-3">
            {(["country", "grid"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                  view === v
                    ? "gradient-primary text-primary-foreground glow-primary"
                    : "glass text-muted-foreground"
                }`}
              >
                {v === "country" ? "Por país" : "Tudo em grade"}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-surface animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && dupAll.length === 0 && (
        <div className="glass-strong rounded-3xl p-8 mt-6 text-center">
          <div className="text-5xl mb-2">⚽</div>
          <p className="font-display text-xl">Nenhuma repetida ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Marque suas figurinhas no álbum e as duplicatas aparecem aqui.
          </p>
          <Link
            to="/album"
            className="inline-block mt-5 px-6 py-3 rounded-full gradient-primary text-primary-foreground glow-primary font-bold text-sm"
          >
            Ir ao álbum
          </Link>
        </div>
      )}

      {/* Country view */}
      {!isLoading && dupAll.length > 0 && view === "country" && (
        <div className="mt-4 space-y-4">
          {grouped.map((c) => {
            const extras = (c.stickers as Sticker[]).reduce((a, s) => a + (s.duplicates - 1), 0);
            return (
              <section key={c.country_code} className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{c.flag_emoji}</span>
                    <p className="font-display text-base tracking-wide truncate">{c.country_name}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gold bg-gold/15 px-2 py-1 rounded-full whitespace-nowrap">
                    {extras} trocáveis
                  </span>
                </div>
                <div className="space-y-2">
                  {(c.stickers as Sticker[]).map((s) => (
                    <DupRow key={s.code} s={s} onPlus={() => addDuplicate(s.code)} onMinus={() => { removeDuplicate(s.code); toast.success(`${s.code} ajustada`); }} />
                  ))}
                </div>
              </section>
            );
          })}

          {specials.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <p className="font-display text-base tracking-wide flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-gold" /> Especiais
              </p>
              <div className="space-y-2">
                {specials.map((s) => (
                  <DupRow key={s.code} s={s} onPlus={() => addDuplicate(s.code)} onMinus={() => { removeDuplicate(s.code); toast.success(`${s.code} ajustada`); }} />
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nada encontrado para "{q}"
            </p>
          )}
        </div>
      )}

      {/* Grid view */}
      {!isLoading && dupAll.length > 0 && view === "grid" && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
          <AnimatePresence>
            {filtered.map((s) => (
              <DupCard key={s.code} s={s} onPlus={() => addDuplicate(s.code)} onMinus={() => removeDuplicate(s.code)} />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">
              Nada encontrado
            </p>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      {dupAll.length > 0 && (
        <div className="fixed bottom-24 md:static md:bottom-auto md:mt-6 inset-x-0 z-40 px-5">
          <div className="max-w-3xl mx-auto">
            <Link
              to="/near"
              className="block w-full text-center py-3.5 rounded-full gradient-primary text-primary-foreground glow-primary font-bold text-sm shadow-card active:scale-[0.98] transition"
            >
              Encontrar trocas com essas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DupRow({ s, onPlus, onMinus }: { s: Sticker; onPlus: () => void; onMinus: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 bg-surface/60 rounded-xl p-2 pr-3"
    >
      <div className="w-12 h-16 rounded-lg overflow-hidden relative shrink-0 border border-primary/30">
        {s.image_url ? (
          <img src={s.image_url} alt={s.code} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">{s.flag_emoji}</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm tracking-wide leading-tight">{s.code}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {s.kind === "crest" ? "Brasão" : s.kind === "team" ? "Time" : s.kind === "special" ? "Especial" : `Jogador #${s.position}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onMinus}
          className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95"
          aria-label="Diminuir"
        >
          <Minus size={14} />
        </button>
        <span className="font-display text-lg text-gold w-7 text-center">{s.duplicates}</span>
        <button
          onClick={onPlus}
          className="w-8 h-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center active:scale-95"
          aria-label="Aumentar"
        >
          <Plus size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function DupCard({ s, onPlus, onMinus }: { s: Sticker; onPlus: () => void; onMinus: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="glass rounded-2xl p-2 flex flex-col gap-2"
    >
      <div className="aspect-[3/4] rounded-xl overflow-hidden relative border border-primary/30">
        {s.image_url ? (
          <img src={s.image_url} alt={s.code} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center text-2xl">{s.flag_emoji}</div>
        )}
        <span className="absolute top-1 right-1 bg-gold text-gold-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {s.duplicates}x
        </span>
      </div>
      <p className="font-display text-xs text-center tracking-wide truncate">{s.code}</p>
      <div className="flex items-center justify-between">
        <button
          onClick={onMinus}
          className="w-7 h-7 rounded-full bg-surface flex items-center justify-center active:scale-95"
          aria-label="Diminuir"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={onPlus}
          className="w-7 h-7 rounded-full bg-gold text-gold-foreground flex items-center justify-center active:scale-95"
          aria-label="Aumentar"
        >
          <Plus size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className={`font-display text-2xl ${color}`}>{value}</p>
    </div>
  );
}
