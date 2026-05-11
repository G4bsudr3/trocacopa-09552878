import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import { ChevronLeft, Loader2, Upload, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  group_letter: string | null;
  position: number;
  image_url: string | null;
  player_name: string | null;
  player_name_source: string | null;
};

const TARGET_TOTAL = 980;
const KINDS = ["player", "crest", "team", "special", "history"] as const;
const SOURCES = ["checklist", "ocr", "manual", ""] as const;
const STATUSES = ["", "missing_name", "missing_image", "complete", "inconsistent"] as const;

function AdminStickers() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState("");
  const [group, setGroup] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<string>("");
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["admin-stickers"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stickers")
        .select("code,country_code,country_name,flag_emoji,kind,group_letter,position,image_url,player_name,player_name_source")
        .order("position");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const countries = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.country_code, `${r.flag_emoji} ${r.country_name}`));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const groups = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.group_letter) s.add(r.group_letter); });
    return Array.from(s).sort();
  }, [rows]);

  const isInconsistent = (r: Row) => {
    const m = r.code.match(/^([A-Z]+)\d+$/);
    return !m || m[1] !== r.country_code;
  };

  const stats = useMemo(() => ({
    total: rows.length,
    withName: rows.filter((r) => r.player_name).length,
    withImage: rows.filter((r) => r.image_url).length,
    inconsistent: rows.filter(isInconsistent).length,
  }), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (country && r.country_code !== country) return false;
      if (kind && r.kind !== kind) return false;
      if (group && r.group_letter !== group) return false;
      if (source !== "") {
        if (source === "(none)" ? !!r.player_name_source : r.player_name_source !== source) return false;
      }
      if (status === "missing_name" && r.player_name) return false;
      if (status === "missing_image" && r.image_url) return false;
      if (status === "complete" && (!r.player_name || !r.image_url)) return false;
      if (status === "inconsistent" && !isInconsistent(r)) return false;
      if (q) {
        const t = q.toLowerCase();
        const hay = `${r.code} ${r.country_name} ${r.player_name ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [rows, q, country, kind, group, source, status]);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [confirmImport, setConfirmImport] = useState<null | { force: boolean }>(null);

  const runImportLoop = async (force = false) => {
    setImporting(true);
    const t = toast.loading("Iniciando importação...");
    let totalInserted = 0, totalUpdated = 0, totalImg = 0, totalFail = 0;
    let batch = 0;
    try {
      while (true) {
        batch++;
        setProgress(`Lote ${batch}...`);
        toast.loading(`Lote ${batch}: importando até 150 itens...`, { id: t });
        const { data, error } = await supabase.functions.invoke("import-checklist", {
          body: { limit: 150, force },
        });
        if (error) throw error;
        totalInserted += data.inserted ?? 0;
        totalUpdated += data.updated ?? 0;
        totalImg += data.image_ok ?? 0;
        totalFail += data.image_failed ?? 0;
        const remaining = data.remaining ?? 0;
        const processed = data.processed ?? 0;
        toast.loading(`Lote ${batch}: ${processed} processados · faltam ${remaining}`, { id: t });
        if (remaining === 0 || processed === 0) break;
        if (batch >= 15) break; // safety
      }
      toast.success(`Importação concluída · ${totalInserted} novos, ${totalUpdated} atualizados, ${totalImg} imagens (${totalFail} falhas)`, { id: t });
      qc.invalidateQueries({ queryKey: ["admin-stickers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar", { id: t });
    } finally {
      setImporting(false);
      setProgress("");
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/home" />;

  const ok = (n: number, expected: number) => n === expected;

  return (
    <div className="px-5 pt-4 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Link to="/settings" className="glass rounded-full p-2"><ChevronLeft size={18} /></Link>
        <h1 className="font-display text-2xl">Admin · Figurinhas</h1>
        <span className="text-xs text-muted-foreground">{filtered.length}/{rows.length}</span>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button
            onClick={() => setConfirmImport({ force: false })}
            disabled={importing}
            className="px-3 py-2 rounded-full gradient-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
            title="Importa só o que falta. Pula o que já tem nome + imagem."
          >
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {importing ? (progress || "Importando...") : "Importar faltantes"}
          </button>
          <button
            onClick={() => setConfirmImport({ force: true })}
            disabled={importing}
            className="px-3 py-2 rounded-full glass text-xs font-semibold disabled:opacity-50"
            title="Reimporta tudo, inclusive imagens já enviadas"
          >
            Reimportar tudo
          </button>
          <button
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke("generate-sticker-images", { body: {} });
                if (error) throw error;
                if (data?.error) return toast.error(data.error);
                toast.success(`Geradas ${data?.ok ?? 0} imagens (${data?.failed ?? 0} falhas)`);
                qc.invalidateQueries({ queryKey: ["admin-stickers"] });
              } catch (e: any) {
                toast.error(e?.message || "Falha ao gerar");
              }
            }}
            disabled={importing}
            className="px-3 py-2 rounded-full glass text-xs font-semibold disabled:opacity-50"
            title="Cria SVG placeholder bonito para jogadores sem imagem"
          >
            Gerar imagens faltantes
          </button>
        </div>
      </div>

      {/* Health panel */}
      <div className="glass rounded-2xl p-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label="Total" value={`${stats.total} / ${TARGET_TOTAL}`} ok={ok(stats.total, TARGET_TOTAL)} onClick={() => { setStatus(""); setCountry(""); setKind(""); setGroup(""); setSource(""); setQ(""); }} />
        <Stat label="Com nome" value={`${stats.withName} / ${stats.total}`} ok={stats.withName === stats.total} onClick={() => setStatus("missing_name")} />
        <Stat label="Com imagem" value={`${stats.withImage} / ${stats.total}`} ok={stats.withImage === stats.total} onClick={() => setStatus("missing_image")} />
        <Stat label="Inconsistências" value={String(stats.inconsistent)} ok={stats.inconsistent === 0} onClick={() => setStatus("inconsistent")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="glass rounded-2xl flex items-center gap-2 px-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (código, país ou jogador)"
            className="bg-transparent flex-1 py-3 text-sm outline-none"
          />
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Todos os países</option>
          {countries.map(([c, n]) => (<option key={c} value={c}>{n}</option>))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Todos os tipos</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Todos os grupos</option>
          {groups.map((g) => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Qualquer origem do nome</option>
          {SOURCES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="(none)">sem origem</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="glass rounded-2xl px-3 py-3 text-sm">
          <option value="">Qualquer status</option>
          <option value="missing_name">Sem nome</option>
          <option value="missing_image">Sem imagem</option>
          <option value="complete">Completo</option>
          <option value="inconsistent">Inconsistente</option>
        </select>
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
              <div className="text-[10px] truncate">{r.player_name ?? <span className="text-muted-foreground">—</span>}</div>
              <div className="text-[10px] text-muted-foreground truncate">{r.flag_emoji} {r.country_name}</div>
              <div className="text-[9px] text-muted-foreground">#{r.position} · {r.kind}{r.group_letter ? ` · ${r.group_letter}` : ""}{r.player_name_source ? ` · ${r.player_name_source}` : ""}</div>
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

      <ConfirmDialog
        open={!!confirmImport}
        onOpenChange={(o) => !o && setConfirmImport(null)}
        title={confirmImport?.force ? "Reimportar TUDO?" : "Importar faltantes?"}
        description={
          confirmImport?.force
            ? "Vai re-baixar imagens já enviadas. Pode levar vários minutos."
            : "Importa só o que falta do Central da Copa. Pula o que já tem nome + imagem."
        }
        confirmLabel={confirmImport?.force ? "Reimportar tudo" : "Importar"}
        destructive={!!confirmImport?.force}
        onConfirm={() => {
          const f = !!confirmImport?.force;
          setConfirmImport(null);
          void runImportLoop(f);
        }}
      />
    </div>
  );
}

function Stat({ label, value, ok, onClick }: { label: string; value: string; ok: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`text-left rounded-xl px-3 py-2 ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-display text-base">{value}</div>
    </button>
  );
}

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [country_name, setName] = useState(row.country_name);
  const [country_code, setCode] = useState(row.country_code);
  const [flag_emoji, setFlag] = useState(row.flag_emoji);
  const [kind, setKind] = useState(row.kind);
  const [group_letter, setGroup] = useState(row.group_letter ?? "");
  const [position, setPosition] = useState(row.position);
  const [player_name, setPlayer] = useState(row.player_name ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy(true);
    const sourceChanged = (player_name || null) !== (row.player_name ?? null);
    const patch = {
      country_name, country_code, flag_emoji, kind, position,
      group_letter: group_letter.trim() || null,
      player_name: player_name || null,
      ...(sourceChanged ? { player_name_source: "manual" } : {}),
    };
    const { error } = await supabase.from("stickers").update(patch as any).eq("code", row.code);
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
          <Field label={`Jogador / Título${row.player_name_source ? ` (${row.player_name_source})` : ""}`}><input value={player_name} onChange={(e) => setPlayer(e.target.value)} className="input" /></Field>
          <Field label="País (nome)"><input value={country_name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
          <Field label="País (código)"><input value={country_code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input" /></Field>
          <Field label="Emoji"><input value={flag_emoji} onChange={(e) => setFlag(e.target.value)} className="input" /></Field>
          <Field label="Grupo"><input value={group_letter} onChange={(e) => setGroup(e.target.value.toUpperCase())} className="input" /></Field>
          <Field label="Tipo">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
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
          <button onClick={() => setConfirmRemove(true)} disabled={busy} className="ml-auto px-4 py-2 rounded-full text-destructive border border-destructive/40 text-sm">
            Excluir
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-full glass text-sm">Fechar</button>
        </div>
      </div>
      <style>{`.input{width:100%;background:transparent;border:1px solid hsl(var(--border));border-radius:.75rem;padding:.5rem .75rem;font-size:.875rem;outline:none}`}</style>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Excluir ${row.code}?`}
        description="A figurinha será removida do catálogo. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => { setConfirmRemove(false); void remove(); }}
      />
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
