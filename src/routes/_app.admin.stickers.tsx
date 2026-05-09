import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import { ChevronLeft, Loader2, Upload, Search, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/stickers")({
  head: () => ({ meta: [{ title: "Admin · Figurinhas" }] }),
  component: AdminStickers,
});

type Row = {
  code: string;
  country_code: string;
  country_name: string;
  flag_emoji: string;
  kind: string;
  position: number;
  image_url: string | null;
  player_name: string | null;
  player_name_source: string | null;
};

function AdminStickers() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["admin-stickers"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("code,country_code,country_name,flag_emoji,kind,position,image_url,player_name,player_name_source")
        .order("country_code")
        .order("position");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const countries = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.country_code, `${r.flag_emoji} ${r.country_name}`));
    return Array.from(m.entries()).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (country && r.country_code !== country) return false;
      if (onlyMissing && r.image_url) return false;
      if (q) {
        const t = q.toLowerCase();
        const hay = `${r.code} ${r.country_name} ${r.player_name ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [rows, q, country, onlyMissing]);

  const [importing, setImporting] = useState(false);
  const runImport = async (skip_images: boolean, only_missing_names: boolean) => {
    if (!confirm(skip_images ? "Importar só nomes faltantes do Central da Copa?" : "Importar TODAS as 980 figurinhas (nomes + imagens) do Central da Copa? Pode levar alguns minutos.")) return;
    setImporting(true);
    const t = toast.loading("Importando do Central da Copa...");
    try {
      const { data, error } = await supabase.functions.invoke("import-checklist", {
        body: { skip_images, only_missing_names },
      });
      if (error) throw error;
      toast.dismiss(t);
      toast.success(`OK · ${data.inserted} criados, ${data.updated} atualizados, ${data.image_ok} imagens (${data.image_failed} falhas)`);
      qc.invalidateQueries({ queryKey: ["admin-stickers"] });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Falha ao importar");
    } finally {
      setImporting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/home" />;

  return (
    <div className="px-5 pt-4 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/settings" className="glass rounded-full p-2"><ChevronLeft size={18} /></Link>
        <h1 className="font-display text-2xl">Admin · Figurinhas</h1>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length}/{rows.length}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <div className="glass rounded-2xl flex items-center gap-2 px-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (código ou país)"
            className="bg-transparent flex-1 py-3 text-sm outline-none"
          />
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Todos os países</option>
          {countries.map(([c, n]) => (<option key={c} value={c}>{n}</option>))}
        </select>
        <label className="glass rounded-2xl px-3 py-3 text-sm flex items-center gap-2">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Só sem imagem
        </label>
      </div>

      {loadingRows ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {filtered.map((r) => (
            <button
              key={r.code}
              onClick={() => setEditing(r)}
              className="glass rounded-xl p-2 text-left hover:ring-2 ring-primary/40 transition"
            >
              <div className="aspect-[3/4] rounded-lg bg-surface overflow-hidden mb-1">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.code} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">sem img</div>
                )}
              </div>
              <div className="text-[10px] font-mono">{r.code}</div>
              <div className="text-[10px] text-muted-foreground truncate">{r.flag_emoji} {r.country_name}</div>
              <div className="text-[9px] text-muted-foreground">#{r.position} · {r.kind}</div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-stickers"] })}
        />
      )}
    </div>
  );
}

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [country_name, setName] = useState(row.country_name);
  const [country_code, setCode] = useState(row.country_code);
  const [flag_emoji, setFlag] = useState(row.flag_emoji);
  const [kind, setKind] = useState(row.kind);
  const [position, setPosition] = useState(row.position);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("stickers")
      .update({ country_name, country_code, flag_emoji, kind, position })
      .eq("code", row.code);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onSaved();
    onClose();
  };

  const upload = async (file: File) => {
    setBusy(true);
    const path = `${row.code}.jpg`;
    const { error } = await supabase.storage.from("sticker-images").upload(path, file, {
      upsert: true, contentType: file.type || "image/jpeg",
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    const url = `${supabase.storage.from("sticker-images").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
    const { error: uerr } = await supabase.from("stickers").update({ image_url: url }).eq("code", row.code);
    setBusy(false);
    if (uerr) return toast.error(uerr.message);
    toast.success("Imagem atualizada");
    onSaved();
    onClose();
  };

  const remove = async () => {
    if (!confirm(`Excluir ${row.code}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("stickers").delete().eq("code", row.code);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-3 items-start mb-4">
          <div className="w-24 aspect-[3/4] rounded-lg bg-surface overflow-hidden">
            {row.image_url ? <img src={row.image_url} className="w-full h-full object-cover" /> : null}
          </div>
          <div className="flex-1">
            <div className="font-mono text-sm">{row.code}</div>
            <div className="text-xs text-muted-foreground mt-1">Editar metadados ou trocar imagem</div>
          </div>
        </div>

        <div className="space-y-2">
          <Field label="País (nome)"><input value={country_name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
          <Field label="País (código)"><input value={country_code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input" /></Field>
          <Field label="Emoji"><input value={flag_emoji} onChange={(e) => setFlag(e.target.value)} className="input" /></Field>
          <Field label="Tipo">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input">
              <option value="crest">crest</option>
              <option value="team">team</option>
              <option value="player">player</option>
              <option value="special">special</option>
            </select>
          </Field>
          <Field label="Posição"><input type="number" value={position} onChange={(e) => setPosition(parseInt(e.target.value || "0"))} className="input" /></Field>
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-full gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-4 py-2 rounded-full glass text-sm font-semibold flex items-center gap-2">
            <Upload size={14} /> Trocar imagem
          </button>
          <button onClick={remove} disabled={busy} className="ml-auto px-4 py-2 rounded-full text-destructive border border-destructive/40 text-sm">
            Excluir
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-full glass text-sm">Fechar</button>
        </div>
      </div>
      <style>{`.input{width:100%;background:transparent;border:1px solid hsl(var(--border));border-radius:.75rem;padding:.5rem .75rem;font-size:.875rem;outline:none}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
