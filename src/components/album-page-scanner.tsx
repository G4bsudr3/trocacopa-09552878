import { useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, X, Check, Sparkles, Repeat2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStickerCatalog } from "@/lib/stickers";
import { useAlbum } from "@/lib/use-album";
import { useQueryClient } from "@tanstack/react-query";
import { ocrAlbumPage } from "@/lib/scan-ocr";

type ItemStatus = "add" | "already" | "missing";
type ScanItem = {
  code: string;
  status: ItemStatus;
  selected: boolean; // for "add": include in commit; for "missing": mark as duplicate
};
type ScannedPage = {
  id: string;
  page_hint: string | null;
  preview: string;
  items: ScanItem[];
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
  const [committing, setCommitting] = useState(false);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [open, setOpen] = useState(false);

  const meta = (code: string) => (catalog.data ?? []).find((c) => c.code === code);

  const totals = useMemo(() => {
    let add = 0, already = 0, missing = 0, dupMark = 0;
    for (const p of pages) {
      for (const it of p.items) {
        if (it.status === "add") { already; missing; if (it.selected) add++; }
        else if (it.status === "already") already++;
        else if (it.status === "missing") { missing++; if (it.selected) dupMark++; }
      }
    }
    return { add, already, missing, dupMark };
  }, [pages]);

  const openPicker = () => fileRef.current?.click();

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

      // Cross-reference with already-owned (across the entire collection + items already queued in session)
      const queuedAdds = new Set(
        pages.flatMap((p) => p.items.filter((i) => i.status === "add").map((i) => i.code))
      );
      const codesToCheck = filled.length ? filled : ["__none__"];
      const { data: existing } = await supabase
        .from("user_stickers")
        .select("sticker_code")
        .eq("user_id", user.id)
        .in("sticker_code", codesToCheck);
      const owned = new Set((existing ?? []).map((r) => r.sticker_code));

      const items: ScanItem[] = [
        ...filled.map<ScanItem>((code) => {
          if (owned.has(code) || queuedAdds.has(code)) {
            return { code, status: "already", selected: false };
          }
          return { code, status: "add", selected: true };
        }),
        ...empty.map<ScanItem>((code) => ({
          code,
          status: owned.has(code) ? "already" : "missing",
          selected: false,
        })),
      ];

      const newPage: ScannedPage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        page_hint,
        preview: dataUrl,
        items,
      };

      setPages((prev) => [...prev, newPage]);
      setOpen(true);

      const newAdds = items.filter((i) => i.status === "add").length;
      toast.success(
        newAdds > 0
          ? `Página detectada: ${newAdds} nova${newAdds > 1 ? "s" : ""} pré-marcada${newAdds > 1 ? "s" : ""}`
          : "Página detectada — revise abaixo"
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao escanear página");
    } finally {
      setScanning(false);
    }
  };

  const toggleItem = (pageId: string, code: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id !== pageId
          ? p
          : { ...p, items: p.items.map((i) => (i.code === code ? { ...i, selected: !i.selected } : i)) }
      )
    );
  };

  const moveItem = (pageId: string, code: string, to: ItemStatus) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              items: p.items.map((i) =>
                i.code === code ? { ...i, status: to, selected: to === "add" ? true : false } : i
              ),
            }
      )
    );
  };

  const removePage = (pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const cancelSession = () => {
    setPages([]);
    setOpen(false);
  };

  const commit = async () => {
    if (!user) return;
    const adds = new Set<string>();
    const dupMarks = new Set<string>();
    for (const p of pages) {
      for (const it of p.items) {
        if (it.status === "add" && it.selected) adds.add(it.code);
        if (it.status === "missing" && it.selected) dupMarks.add(it.code);
      }
    }

    if (adds.size === 0 && dupMarks.size === 0) {
      toast.message("Nada selecionado para adicionar");
      return;
    }

    setCommitting(true);
    try {
      if (adds.size > 0) {
        const rows = Array.from(adds).map((code) => ({
          user_id: user.id,
          sticker_code: code,
          duplicates: 1,
        }));
        const { error: upErr } = await supabase
          .from("user_stickers")
          .upsert(rows, { onConflict: "user_id,sticker_code" });
        if (upErr) throw upErr;
      }

      for (const code of dupMarks) {
        await addDuplicate(code);
      }

      qc.invalidateQueries({ queryKey: ["user_stickers", user.id] });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });

      toast.success(
        `${adds.size} adicionada${adds.size === 1 ? "" : "s"}${
          dupMarks.size > 0 ? ` · ${dupMarks.size} repetida${dupMarks.size === 1 ? "" : "s"}` : ""
        } 🎉`
      );
      setPages([]);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setCommitting(false);
    }
  };

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
        onClick={openPicker}
        disabled={scanning}
        className="w-full mt-3 glass-strong rounded-full py-3.5 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60 border border-primary/40"
      >
        {scanning ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
        {scanning ? "Analisando página..." : "Escanear página — revise e adicione várias"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[92vh] bg-surface rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div>
                  <h3 className="font-display text-xl flex items-center gap-2">
                    <Sparkles size={16} className="text-gold" /> Sessão de scan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pages.length} página{pages.length === 1 ? "" : "s"} · revise antes de finalizar
                  </p>
                </div>
                <button
                  onClick={cancelSession}
                  className="w-9 h-9 rounded-full glass flex items-center justify-center"
                  aria-label="Descartar"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-3 gap-2 p-4">
                <div className="rounded-2xl bg-primary/10 border border-primary/30 p-3 text-center">
                  <div className="text-2xl font-display text-primary">{totals.add}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">A adicionar</div>
                </div>
                <div className="rounded-2xl bg-muted/30 border border-border/50 p-3 text-center">
                  <div className="text-2xl font-display">{totals.already}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Já tinha</div>
                </div>
                <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 text-center">
                  <div className="text-2xl font-display text-destructive">{totals.missing}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Faltando</div>
                </div>
              </div>

              {/* Pages list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
                {pages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    Nenhuma página na sessão. Toque em "Escanear outra".
                  </div>
                )}
                {pages.map((p, idx) => {
                  const adds = p.items.filter((i) => i.status === "add");
                  const missing = p.items.filter((i) => i.status === "missing");
                  const already = p.items.filter((i) => i.status === "already");
                  return (
                    <div key={p.id} className="rounded-2xl border border-border/50 bg-surface/60 overflow-hidden">
                      <div className="flex items-center gap-3 p-3 border-b border-border/40">
                        <img
                          src={p.preview}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover ring-1 ring-border/40"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold">Página {idx + 1}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {p.page_hint ?? "—"}
                          </div>
                        </div>
                        <button
                          onClick={() => removePage(p.id)}
                          className="w-8 h-8 rounded-full glass flex items-center justify-center text-destructive"
                          aria-label="Remover página"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="p-3 space-y-3">
                        {adds.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Check size={12} className="text-primary" />
                              <h5 className="text-[11px] font-bold uppercase tracking-wide">
                                Vou adicionar — toque para desmarcar
                              </h5>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {adds.map((it) => {
                                const m = meta(it.code);
                                return (
                                  <button
                                    key={it.code}
                                    onClick={() => toggleItem(p.id, it.code)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition active:scale-95 ${
                                      it.selected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/40 text-muted-foreground line-through"
                                    }`}
                                  >
                                    {m?.flag_emoji ?? "⚽"} {it.code}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {missing.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <AlertCircle size={12} className="text-destructive" />
                              <h5 className="text-[11px] font-bold uppercase tracking-wide">
                                Faltando — toque "Tenho" se já coloquei
                              </h5>
                            </div>
                            <div className="space-y-1.5">
                              {missing.map((it) => {
                                const m = meta(it.code);
                                return (
                                  <div
                                    key={it.code}
                                    className="flex items-center gap-2 p-1.5 rounded-xl border border-border/40"
                                  >
                                    <div className="text-[11px] font-bold w-14 shrink-0">{it.code}</div>
                                    <div className="flex-1 text-[11px] text-muted-foreground truncate">
                                      {m?.flag_emoji ?? "⚽"} {m?.country_name ?? "—"}
                                    </div>
                                    <button
                                      onClick={() => moveItem(p.id, it.code, "add")}
                                      className="px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold active:scale-95"
                                    >
                                      Tenho
                                    </button>
                                    <button
                                      onClick={() => toggleItem(p.id, it.code)}
                                      className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 active:scale-95 ${
                                        it.selected
                                          ? "bg-gold text-gold-foreground"
                                          : "bg-muted/40 text-muted-foreground"
                                      }`}
                                    >
                                      <Repeat2 size={10} /> Repetida
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {already.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Check size={12} className="text-muted-foreground" />
                              <h5 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Já tinha
                              </h5>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {already.map((it) => {
                                const m = meta(it.code);
                                return (
                                  <span
                                    key={it.code}
                                    className="text-[11px] font-semibold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground"
                                  >
                                    {m?.flag_emoji ?? "⚽"} {it.code}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer actions */}
              <div className="p-4 border-t border-border/50 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  onClick={openPicker}
                  disabled={scanning}
                  className="w-full glass-strong rounded-full py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
                >
                  {scanning ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {scanning ? "Analisando..." : "Escanear outra página"}
                </button>
                <button
                  onClick={commit}
                  disabled={committing || (totals.add === 0 && totals.dupMark === 0)}
                  className="w-full gradient-primary text-primary-foreground rounded-full py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {committing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Finalizar ({totals.add + totals.dupMark})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
