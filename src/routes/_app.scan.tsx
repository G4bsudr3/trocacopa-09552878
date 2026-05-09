import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Repeat, Search, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAlbum } from "@/lib/use-album";
import { useStickerCatalog } from "@/lib/stickers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/scan")({
  head: () => ({ meta: [{ title: "Escanear figurinha — TrocaCopa" }] }),
  component: Scan,
});

function Scan() {
  const nav = useNavigate();
  const catalog = useStickerCatalog();
  const { stickers, addDuplicate, toggleOwned } = useAlbum();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = !query
    ? []
    : (catalog.data ?? [])
        .filter((s) => {
          const q = query.toLowerCase();
          return (
            s.code.toLowerCase() === q ||
            s.code.toLowerCase().startsWith(q) ||
            s.country_name.toLowerCase().includes(q) ||
            s.country_code.toLowerCase() === q
          );
        })
        .slice(0, 8);

  const register = (code: string, asDup: boolean) => {
    const cur = stickers.find((s) => s.code === code);
    if (asDup) {
      addDuplicate(code);
      toast.success(`${code} marcada como repetida 🔁`);
    } else if (!cur?.owned) {
      toggleOwned(code);
      toast.success(`${code} adicionada ✅`);
    } else {
      toast.message(`Você já tem a ${code}`);
    }
    setRecent((r) => [code, ...r.filter((n) => n !== code)].slice(0, 6));
    setQuery("");
  };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Escanear Figurinha</h1>

      <div className="mt-5 relative aspect-[3/4] rounded-3xl overflow-hidden glass-strong">
        <div className="absolute inset-0 bg-gradient-to-br from-surface to-background" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[70%] h-[80%]">
            {[
              "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
              "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
            ].map((cls) => (
              <div key={cls} className={`absolute w-12 h-12 border-primary ${cls}`} />
            ))}
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-primary glow-primary"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <Camera className="absolute inset-0 m-auto text-primary/40" size={64} />
          </div>
        </div>

        <div className="absolute bottom-5 inset-x-0 text-center px-6">
          <p className="text-sm text-muted-foreground mb-3">
            Digite o código (BRA10, FWC7, CC3) ou país para registrar no álbum
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-4 border border-transparent focus-within:border-primary">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: BRA10, FWC7 ou Brasil"
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {matches.length > 0 && (
        <div className="space-y-2 mt-3">
          {matches.map((s) => {
            const owned = stickers.find((x) => x.code === s.code)?.owned;
            return (
              <div key={s.code} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div
                  className={`w-12 h-16 rounded-lg flex flex-col items-center justify-center font-display ${
                    owned
                      ? "gradient-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground"
                  }`}
                >
                  <span className="text-base leading-none">{s.flag_emoji}</span>
                  <span className="text-[10px] mt-0.5">{s.code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.country_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.kind === "country"
                      ? `Grupo ${s.group_letter} · pos ${s.position}`
                      : s.kind === "history"
                        ? "FIFA World Cup History"
                        : s.kind === "special"
                          ? "Coca-Cola"
                          : "Capa do álbum"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => register(s.code, false)}
                    className="px-3 py-2 rounded-full gradient-primary text-primary-foreground text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={12} /> Tenho
                  </button>
                  <button
                    onClick={() => register(s.code, true)}
                    className="px-3 py-2 rounded-full bg-gold text-gold-foreground text-xs font-bold flex items-center gap-1"
                  >
                    <Repeat size={12} /> Rep.
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl tracking-wide mb-3">Recentes</h2>
          <div className="grid grid-cols-3 gap-2">
            {recent.map((code) => {
              const s = (catalog.data ?? []).find((x) => x.code === code);
              return (
                <div key={code} className="glass rounded-xl p-2 text-center">
                  <p className="text-lg leading-none">{s?.flag_emoji ?? "·"}</p>
                  <p className="font-display text-sm text-primary mt-1">{code}</p>
                  {s && (
                    <p className="text-[10px] text-muted-foreground truncate">{s.country_name}</p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => nav({ to: "/album" })}
            className="mt-3 w-full glass rounded-full py-2.5 text-sm font-semibold"
          >
            Ver álbum completo →
          </button>
        </section>
      )}
    </div>
  );
}
