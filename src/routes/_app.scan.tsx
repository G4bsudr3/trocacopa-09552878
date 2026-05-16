import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Repeat, Search, Loader2, Sparkles, X, Gift } from "lucide-react";
import { toast } from "sonner";
import { useAlbum } from "@/lib/use-album";
import { useStickerCatalog, type StickerCatalogItem } from "@/lib/stickers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadContribution } from "@/lib/contributions";
import { AlbumPageScanner } from "@/components/album-page-scanner";

export const Route = createFileRoute("/_app/scan")({
  head: () => ({
    meta: [
      { title: "Escanear figurinha — TrocaCopa" },
      { name: "description", content: "Use a câmera para identificar figurinhas da Copa 2026 e adicioná-las direto ao seu álbum." },
      { property: "og:title", content: "Escanear figurinha — TrocaCopa" },
      { property: "og:description", content: "Identifique e adicione figurinhas ao álbum com a câmera." },
      { property: "og:url", content: "https://trocacopa.lovable.app/scan" },
    ],
  }),
  component: Scan,
});

function Scan() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const catalog = useStickerCatalog();
  const { stickers, addDuplicate, toggleOwned } = useAlbum();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<StickerCatalogItem | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ code: string; player_name: string | null; country_name: string | null; flag_emoji: string | null; score: number }>>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [donated, setDonated] = useState(false);
  const [donating, setDonating] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canDonate = profile?.kids_mode === false;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setPreview(null);
      setResult(null);
      setSuggestions([]);
      // attach in next tick after element mounts
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e: any) {
      toast.error(
        e?.name === "NotAllowedError"
          ? "Permissão da câmera negada"
          : e?.name === "NotFoundError"
            ? "Nenhuma câmera encontrada"
            : "Não consegui abrir a câmera — usando upload",
      );
      fileRef.current?.click();
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!blob) return toast.error("Falha ao capturar imagem");
    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    stopCamera();
    handleFile(file);
  };

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

  const registerProgressive = (code: string) => {
    const cur = stickers.find((s) => s.code === code);
    if (!cur || !cur.owned) {
      toggleOwned(code);
      toast.success(`${code} adicionada ao álbum ✅`);
    } else {
      addDuplicate(code);
      const next = (cur.duplicates ?? 1) + 1;
      toast.success(
        next === 2 ? `${code} agora é repetida (2x) 🔁` : `${code} +1 repetida (${next}x)`,
      );
    }
    setRecent((r) => [code, ...r.filter((n) => n !== code)].slice(0, 6));
    setQuery("");
    setPreview(null);
    setResult(null);
  };

  const dupCount = (code: string) => stickers.find((x) => x.code === code)?.duplicates ?? 0;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem");
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setScanning(true);
    setSuggestions([]);
    setResult(null);
    setLastFile(file);
    setDonated(false);
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
        setResult(real);
        setQuery("");
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

  useEffect(() => () => stopCamera(), []);

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
        {cameraOpen ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center"
              aria-label="Fechar câmera"
            >
              <X size={16} />
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[70%] h-[80%]">
                {[
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
                ].map((cls) => (
                  <div key={cls} className={`absolute w-12 h-12 border-primary ${cls}`} />
                ))}
              </div>
            </div>
            <button
              onClick={capturePhoto}
              aria-label="Capturar"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-primary border-4 border-background glow-primary active:scale-95 transition flex items-center justify-center"
            >
              <Camera size={26} className="text-primary-foreground" strokeWidth={2.5} />
            </button>
          </>
        ) : preview ? (
          <>
            <img src={preview} alt="figurinha" className="absolute inset-0 w-full h-full object-cover" />
            <button
              onClick={() => { setPreview(null); setResult(null); setSuggestions([]); }}
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
                Aponte a câmera para a figurinha — a IA identifica automaticamente
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={openCamera}
          disabled={scanning || cameraOpen}
          className="gradient-primary text-primary-foreground rounded-full py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
        >
          <Camera size={18} />
          Abrir câmera
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning || cameraOpen}
          className="glass-strong rounded-full py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
        >
          {scanning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {scanning ? "Analisando..." : "Enviar imagem"}
        </button>
      </div>

      <AlbumPageScanner />

      {result && (() => {
        const owned = stickers.find((x) => x.code === result.code)?.owned ?? false;
        const dup = dupCount(result.code);
        return (
          <div className="mt-4 glass-strong rounded-3xl p-4">
            <div className="flex gap-4">
              <div className="relative shrink-0">
                {result.image_url ? (
                  <img
                    src={result.image_url}
                    alt={result.country_name}
                    className="w-24 h-32 rounded-xl object-cover ring-2 ring-primary/40"
                  />
                ) : (
                  <div className="w-24 h-32 rounded-xl gradient-primary text-primary-foreground flex flex-col items-center justify-center font-display">
                    <span className="text-3xl leading-none">{result.flag_emoji}</span>
                    <span className="text-xs mt-1">{result.code}</span>
                  </div>
                )}
                {dup > 1 && (
                  <span className="absolute -top-2 -right-2 bg-gold text-gold-foreground text-[10px] font-bold rounded-full px-2 py-0.5 shadow">
                    x{dup}
                  </span>
                )}
                {owned && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Check size={10} /> Possuída
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl text-primary">{result.code}</span>
                  <span className="text-lg">{result.flag_emoji}</span>
                </div>
                <p className="font-semibold text-sm truncate mt-0.5">
                  {result.kind === "player" && result.player_name ? result.player_name : result.country_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.kind === "player"
                    ? `${result.country_name} · pos ${result.position}`
                    : result.kind === "country"
                      ? `Grupo ${result.group_letter} · pos ${result.position}`
                      : result.kind === "history"
                        ? "FIFA World Cup History"
                        : result.kind === "special"
                          ? "Especial"
                          : "Capa do álbum"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => registerProgressive(result.code)}
                className={`w-full px-3 py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition ${
                  dup === 0
                    ? "gradient-primary text-primary-foreground glow-primary"
                    : "bg-gold text-gold-foreground"
                }`}
              >
                {dup === 0 ? (
                  <><Check size={16} /> Tenho</>
                ) : (
                  <><Repeat size={16} /> +1 Repetida (próx: {dup + 1}x)</>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setResult(null)}
                className="px-3 py-2 rounded-full glass text-xs font-semibold"
              >
                Não é essa
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-full glass text-xs font-semibold"
              >
                Trocar foto
              </button>
            </div>

            {canDonate && lastFile && !donated && (
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Gift size={14} className="text-primary" /> Sua foto ficou boa?
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Doe como exemplo desta figurinha. Vai pra curadoria — só publicamos se ficar perfeita.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    disabled={donating}
                    onClick={async () => {
                      if (!lastFile || !result) return;
                      setDonating(true);
                      const r = await uploadContribution(lastFile, "sticker", result.code);
                      setDonating(false);
                      if (r) {
                        setDonated(true);
                        toast.success("Obrigado pela doação 💙");
                      } else {
                        toast.error("Não consegui enviar. Tente de novo.");
                      }
                    }}
                    className="px-3 py-2 rounded-full gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {donating ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />} Sim, doar
                  </button>
                  <button
                    onClick={() => setDonated(true)}
                    className="px-3 py-2 rounded-full glass text-xs font-semibold"
                  >
                    Não
                  </button>
                </div>
              </div>
            )}
            {donated && lastFile && canDonate && (
              <p className="mt-3 text-[11px] text-center text-primary">✨ Obrigado! Sua foto está na fila de curadoria.</p>
            )}
          </div>
        );
      })()}

      <div className="flex items-center gap-3 bg-input rounded-full px-4 py-3 mt-4 border border-transparent focus-within:border-primary">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: BRA10, FWC7 ou Brasil"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="text-muted-foreground hover:text-foreground active:scale-90 transition"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 glass-strong rounded-2xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Você quis dizer?</p>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const cat = (catalog.data ?? []).find((c) => c.code.toLowerCase() === s.code.toLowerCase());
              return (
                <button
                  key={s.code}
                  onClick={() => { registerProgressive(s.code); setSuggestions([]); }}
                  className="w-full glass rounded-xl p-2.5 flex items-center gap-3 text-left active:scale-[0.98] transition"
                >
                  {cat?.image_url ? (
                    <img src={cat.image_url} alt={s.code} className="w-10 h-14 rounded-lg object-cover ring-1 ring-primary/30 shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded-lg gradient-primary text-primary-foreground flex flex-col items-center justify-center font-display shrink-0">
                      <span className="text-base leading-none">{s.flag_emoji ?? "·"}</span>
                      <span className="text-[10px] mt-0.5">{s.code}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.player_name ?? s.code}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.country_name} · {Math.round(s.score * 100)}% match
                    </p>
                  </div>
                  <Check size={16} className="text-primary" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-2 mt-3">
          {matches.map((s) => {
            const userS = stickers.find((x) => x.code === s.code);
            const owned = userS?.owned;
            const dup = userS?.duplicates ?? 0;
            return (
              <div key={s.code} className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="relative shrink-0">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.country_name}
                      className={`w-12 h-16 rounded-lg object-cover ${owned ? "ring-2 ring-primary/40" : "opacity-90"}`}
                    />
                  ) : (
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
                  )}
                  {dup > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gold text-gold-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5">
                      x{dup}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {s.kind === "player" && s.player_name ? s.player_name : s.country_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.kind === "player"
                      ? `${s.country_name} · pos ${s.position}`
                      : s.kind === "country"
                        ? `Grupo ${s.group_letter} · pos ${s.position}`
                        : s.kind === "history"
                          ? "FIFA World Cup History"
                        : s.kind === "special"
                          ? "Especial"
                          : "Capa do álbum"}
                  </p>
                </div>
                <div className="flex">
                  <button
                    onClick={() => registerProgressive(s.code)}
                    className={`px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition ${
                      dup === 0
                        ? "gradient-primary text-primary-foreground"
                        : "bg-gold text-gold-foreground"
                    }`}
                  >
                    {dup === 0 ? (
                      <><Check size={12} /> Tenho</>
                    ) : (
                      <><Repeat size={12} /> +1 ({dup + 1}x)</>
                    )}
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
                <div key={code} className="glass rounded-xl p-2 flex flex-col items-center">
                  {s?.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.country_name}
                      loading="lazy"
                      className="w-full aspect-[3/4] rounded-lg object-cover ring-1 ring-primary/30"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] rounded-lg gradient-primary text-primary-foreground flex flex-col items-center justify-center font-display">
                      <span className="text-2xl leading-none">{s?.flag_emoji ?? "·"}</span>
                      <span className="text-[10px] mt-1">{code}</span>
                    </div>
                  )}
                  <p className="font-display text-sm text-primary mt-1.5">{code}</p>
                  {s && (
                    <p className="text-[10px] text-muted-foreground truncate w-full text-center">{s.country_name}</p>
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
