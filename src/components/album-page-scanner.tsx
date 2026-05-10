import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, X, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStickerCatalog } from "@/lib/stickers";
import { useQueryClient } from "@tanstack/react-query";

type Slot = {
  code: string;
  status: "filled" | "empty";
  selected: boolean;
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
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageHint, setPageHint] = useState<string | null>(null);

  const close = () => {
    setSlots(null);
    setPreview(null);
    setPageHint(null);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem");
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setScanning(true);
    setSlots(null);
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
      setPageHint(typeof data?.page_hint === "string" ? data.page_hint : null);

      const all: Slot[] = [
        ...filled.map((code) => ({ code, status: "filled" as const, selected: true })),
        ...empty.map((code) => ({ code, status: "empty" as const, selected: false })),
      ];
      // dedupe (filled wins)
      const seen = new Map<string, Slot>();
      for (const s of all) {
        const prev = seen.get(s.code);
        if (!prev || (prev.status === "empty" && s.status === "filled")) seen.set(s.code, s);
      }
      const list = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
      setSlots(list);

      const total = list.length;
      const fill = list.filter((s) => s.status === "filled").length;
      if (total === 0) toast.error("Não consegui identificar nenhuma figurinha. Tente uma foto mais nítida.");
      else toast.success(`Detectei ${total} figurinhas — ${fill} coladas, ${total - fill} vazias`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao escanear página");
    } finally {
      setScanning(false);
    }
  };

  const toggle = (code: string) => {
    setSlots((cur) => cur?.map((s) => (s.code === code ? { ...s, selected: !s.selected } : s)) ?? null);
  };

  const save = async () => {
    if (!user || !slots) return;
    const toAdd = slots.filter((s) => s.selected).map((s) => s.code);
    if (toAdd.length === 0) {
      toast.message("Nenhuma figurinha marcada");
      return;
    }
    setSaving(true);
    try {
      // fetch existing duplicates to merge
      const { data: existing } = await supabase
        .from("user_stickers")
        .select("sticker_code,duplicates")
        .eq("user_id", user.id)
        .in("sticker_code", toAdd);
      const dupMap = new Map<string, number>();
      (existing ?? []).forEach((r) => dupMap.set(r.sticker_code, r.duplicates));

      const rows = toAdd.map((code) => ({
        user_id: user.id,
        sticker_code: code,
        duplicates: Math.max(1, dupMap.get(code) ?? 0),
      }));
      const { error } = await supabase
        .from("user_stickers")
        .upsert(rows, { onConflict: "user_id,sticker_code" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["user_stickers", user.id] });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      const added = toAdd.filter((c) => !dupMap.has(c)).length;
      toast.success(`${added} novas figurinhas no álbum 🎉`);
      close();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
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
        {scanning ? "Analisando página..." : "Escanear página inteira do álbum"}
      </button>

      <AnimatePresence>
        {slots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={close}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[92vh] bg-surface rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div>
                  <h3 className="font-display text-xl flex items-center gap-2">
                    <Sparkles size={16} className="text-gold" /> Revisar página
                  </h3>
                  {pageHint && <p className="text-xs text-muted-foreground mt-0.5">{pageHint}</p>}
                </div>
                <button onClick={close} className="w-9 h-9 rounded-full glass flex items-center justify-center" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              {preview && (
                <img src={preview} alt="página" className="w-full max-h-40 object-cover" />
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Marque as figurinhas que você <strong>já tem coladas</strong>. Vamos adicionar ao seu álbum.
                </p>
                {slots.map((s) => {
                  const m = meta(s.code);
                  return (
                    <button
                      key={s.code}
                      onClick={() => toggle(s.code)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition ${
                        s.selected
                          ? "border-primary bg-primary/10"
                          : "border-border/50 bg-surface/60"
                      }`}
                    >
                      <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 ring-1 ring-primary/20">
                        {m?.image_url ? (
                          <img src={m.image_url} alt={s.code} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full gradient-primary text-primary-foreground flex flex-col items-center justify-center text-[10px]">
                            <span className="text-lg leading-none">{m?.flag_emoji ?? "⚽"}</span>
                            <span>{s.code}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-bold">{s.code}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m?.country_name ?? "—"} · {s.status === "filled" ? "Detectada como colada" : "Detectada como vazia"}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${s.selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {s.selected && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 border-t border-border/50 flex gap-2">
                <button onClick={close} className="flex-1 glass rounded-full py-3 font-semibold">
                  Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 gradient-primary text-primary-foreground rounded-full py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Adicionar ao álbum
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
