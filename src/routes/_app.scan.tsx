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
  const [suggestions, setSuggestions] = useState<Array<{ code: string; player_name: string | null; country_name: string | null; flag_emoji: string | null; score: number }>>([]);
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
    setPreview(null);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem");
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setScanning(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("scan-sticker", { body: { image: dataUrl } });
      if (error) throw error;
      if (data?.error === "credits_exhausted") return toast.error("Créditos de IA esgotados");
      if (data?.error === "rate_limited") return toast.error("Muitas requisições, aguarde um instante");
      if (data?.error) return toast.error("Falha ao analisar: " + data.error);

      const code: string | null = data?.code;
      const player: string | null = data?.player_name;
      const country: string | null = data?.country_name;
      const flag: string | null = data?.flag_emoji;
      const conf: number = data?.confidence ?? 0;
      const sugg = Array.isArray(data?.suggestions) ? data.suggestions : [];

      if (code && (catalog.data ?? []).some((s) => s.code.toLowerCase() === code.toLowerCase())) {
        const real = (catalog.data ?? []).find((s) => s.code.toLowerCase() === code.toLowerCase())!;
        setQuery(real.code);
        const label = player ? `${real.code} — ${player} ${flag ?? real.flag_emoji}` : `${real.code} ${real.flag_emoji}`;
        toast.success(`Identificada: ${label} (${Math.round(conf * 100)}%)`);
      } else if (sugg.length) {
        setSuggestions(sugg);
        toast.message(`Não tenho certeza — ${sugg.length} sugestão${sugg.length > 1 ? "ões" : ""} abaixo`);
      } else if (player || country) {
        setQuery(player || country || "");
        toast.message(player ? `Jogador: ${player}${country ? ` (${country})` : ""}` : `País: ${country}`);
      } else {
        toast.error("Não consegui ler. Tente uma foto mais nítida ou digite manualmente.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao escanear");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Escanear Figurinha</h1>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="mt-5 relative aspect-[3/4] rounded-3xl overflow-hidden glass-strong">
        {preview ? (
          <>
            <img src={preview} alt="figurinha" className="absolute inset-0 w-full h-full object-cover" />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
            {scanning && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm font-semibold flex items-center gap-1">
                  <Sparkles size={14} className="text-gold" /> Identificando figurinha...
                </p>
              </div>
            )}
          </>
        ) : (
          <>
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
              <p className="text-xs text-muted-foreground">
                Tire uma foto da figurinha — a IA identifica automaticamente
              </p>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="w-full mt-3 gradient-primary text-primary-foreground rounded-full py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
      >
        {scanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        {scanning ? "Analisando..." : "Tirar foto / Enviar imagem"}
      </button>

      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-4 border border-transparent focus-within:border-primary">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: BRA10, FWC7 ou Brasil"
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 glass-strong rounded-2xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Você quis dizer?</p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button
                key={s.code}
                onClick={() => { register(s.code, false); setSuggestions([]); }}
                className="w-full glass rounded-xl p-2.5 flex items-center gap-3 text-left active:scale-[0.98] transition"
              >
                <div className="w-10 h-14 rounded-lg gradient-primary text-primary-foreground flex flex-col items-center justify-center font-display">
                  <span className="text-base leading-none">{s.flag_emoji ?? "·"}</span>
                  <span className="text-[10px] mt-0.5">{s.code}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.player_name ?? s.code}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.country_name} · {Math.round(s.score * 100)}% match
                  </p>
                </div>
                <Check size={16} className="text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
