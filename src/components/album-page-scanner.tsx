import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, X, Check, Sparkles, Repeat2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStickerCatalog } from "@/lib/stickers";
import { useAlbum } from "@/lib/use-album";
import { useQueryClient } from "@tanstack/react-query";

type Summary = {
  added: string[];
  already: string[];
  missing: string[];
  page_hint: string | null;
  preview: string | null;
};

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function AlbumPageScanner() {
  const { user } = useAuth();
  const catalog = useStickerCatalog();
  const { addDuplicate } = useAlbum();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const close = () => setSummary(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem");
    if (!user) return toast.error("Faça login para escanear");
    const dataUrl = await fileToDataUrl(file);
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-album-page", {
        body: { image: dataUrl },
      });
      if (error) throw error;
      if (data?.error === "credits_exhausted") return toast.error("Créditos de IA esgotados");
      if (data?.error === "rate_limited") return toast.error("Muitas requisições, aguarde um instante");
      if (data?.error) return toast.error("Falha ao analisar: " + data.error);

      const filled: string[] = Array.isArray(data?.filled) ? data.filled : [];
      const empty: string[] = Array.isArray(data?.empty) ? data.empty : [];
      const page_hint: string | null = typeof data?.page_hint === "string" ? data.page_hint : null;

      if (filled.length === 0 && empty.length === 0) {
        return toast.error("Não consegui identificar nenhuma figurinha. Tente uma foto mais nítida.");
      }

      // Check what user already has
      const { data: existing } = await supabase
        .from("user_stickers")
        .select("sticker_code")
        .eq("user_id", user.id)
        .in("sticker_code", filled.length ? filled : ["__none__"]);
      const owned = new Set((existing ?? []).map((r) => r.sticker_code));

      const toInsert = filled.filter((c) => !owned.has(c));
      const already = filled.filter((c) => owned.has(c));

      if (toInsert.length > 0) {
        const rows = toInsert.map((code) => ({
          user_id: user.id,
          sticker_code: code,
          duplicates: 1,
        }));
        const { error: upErr } = await supabase
          .from("user_stickers")
          .upsert(rows, { onConflict: "user_id,sticker_code" });
        if (upErr) throw upErr;
        qc.invalidateQueries({ queryKey: ["user_stickers", user.id] });
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
      }

      setSummary({
        added: toInsert,
        already,
        missing: empty,
        page_hint,
        preview: dataUrl,
      });

      if (toInsert.length > 0) {
        toast.success(`${toInsert.length} figurinha${toInsert.length > 1 ? "s" : ""} adicionada${toInsert.length > 1 ? "s" : ""} 🎉`);
      } else {
        toast.message("Nenhuma figurinha nova — veja o que falta abaixo");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao escanear página");
    } finally {
      setScanning(false);
    }
  };

  const meta = (code: string) => (catalog.data ?? []).find((c) => c.code === code);

  return (
    <>
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
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="w-full mt-3 glass-strong rounded-full py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60 border border-primary/40"
      >
        {scanning ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
        {scanning ? "Analisando página..." : "Escanear página — adiciona e mostra o que falta"}
      </button>

      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={close}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[92vh] bg-surface rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col pb-32 md:pb-0"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div>
                  <h3 className="font-display text-xl flex items-center gap-2">
                    <Sparkles size={16} className="text-gold" /> Página escaneada
                  </h3>
                  {summary.page_hint && (
                    <p className="text-xs text-muted-foreground mt-0.5">{summary.page_hint}</p>
                  )}
                </div>
                <button onClick={close} className="w-9 h-9 rounded-full glass flex items-center justify-center" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 p-4">
                <div className="rounded-2xl bg-primary/10 border border-primary/30 p-3 text-center">
                  <div className="text-2xl font-display text-primary">{summary.added.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Adicionadas</div>
                </div>
                <div className="rounded-2xl bg-muted/30 border border-border/50 p-3 text-center">
                  <div className="text-2xl font-display">{summary.already.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Já tinha</div>
                </div>
                <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 text-center">
                  <div className="text-2xl font-display text-destructive">{summary.missing.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Faltando</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                {summary.added.length > 0 && (
                  <Section
                    title="Adicionadas agora"
                    icon={<Check size={14} className="text-primary" />}
                    codes={summary.added}
                    meta={meta}
                  />
                )}

                {summary.missing.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle size={14} className="text-destructive" />
                      <h4 className="text-xs font-bold uppercase tracking-wide">Faltando nesta página</h4>
                    </div>
                    <div className="space-y-2">
                      {summary.missing.map((code) => {
                        const m = meta(code);
                        return (
                          <div
                            key={code}
                            className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/50 bg-surface/60"
                          >
                            <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 ring-1 ring-destructive/30 bg-muted/30 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-muted-foreground">{code}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm">{code}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {m?.flag_emoji ?? "⚽"} {m?.country_name ?? "—"}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                addDuplicate(code);
                                toast.success(`${code} marcada como repetida`);
                              }}
                              className="px-2.5 py-1.5 rounded-full bg-gold text-gold-foreground text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                            >
                              <Repeat2 size={12} /> Tenho
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : summary.added.length > 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    🎉 Página completa! Nenhuma figurinha faltando aqui.
                  </p>
                ) : null}

                {summary.already.length > 0 && (
                  <Section
                    title="Você já tinha"
                    icon={<Check size={14} className="text-muted-foreground" />}
                    codes={summary.already}
                    meta={meta}
                    muted
                  />
                )}
              </div>

              <div className="p-4 border-t border-border/50">
                <button onClick={close} className="w-full gradient-primary text-primary-foreground rounded-full py-3 font-bold">
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  title,
  icon,
  codes,
  meta,
  muted,
}: {
  title: string;
  icon: React.ReactNode;
  codes: string[];
  meta: (c: string) => { country_name: string; flag_emoji: string; image_url: string | null } | undefined;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h4 className="text-xs font-bold uppercase tracking-wide">{title}</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {codes.map((c) => {
          const m = meta(c);
          return (
            <span
              key={c}
              className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                muted ? "bg-muted/40 text-muted-foreground" : "bg-primary/15 text-primary"
              }`}
            >
              {m?.flag_emoji ?? "⚽"} {c}
            </span>
          );
        })}
      </div>
    </div>
  );
}
