import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type TargetType = "user" | "trade" | "message";
type Reason = "improper_language" | "strange_behavior" | "asked_personal_info" | "adult_content" | "other";

const REASONS: { value: Reason; label: string; emoji: string }[] = [
  { value: "improper_language", label: "Linguagem imprópria", emoji: "🤬" },
  { value: "strange_behavior", label: "Comportamento estranho", emoji: "⚠️" },
  { value: "asked_personal_info", label: "Pediu meus dados pessoais", emoji: "🚫" },
  { value: "adult_content", label: "Conteúdo adulto / impróprio", emoji: "🔞" },
  { value: "other", label: "Outro motivo", emoji: "📝" },
];

export function ReportButton({
  targetType,
  targetId,
  className = "",
  label = "Denunciar",
}: {
  targetType: TargetType;
  targetId: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition ${className}`}
        aria-label="Denunciar"
      >
        <Flag size={12} /> {label}
      </button>
      {open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({
  targetType, targetId, onClose,
}: {
  targetType: TargetType;
  targetId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("content_reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim().slice(0, 500) || null,
      });
      if (error) throw error;
      toast.success("Denúncia enviada. Nossa equipe vai revisar 🛡️");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-3"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-strong rounded-3xl p-5 shadow-card mb-3 sm:mb-0"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-primary flex items-center gap-2">
              <Flag size={18} /> Denunciar
            </h3>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          <p className="text-xs text-muted-foreground mb-3">Qual o motivo?</p>
          <div className="space-y-2 mb-3">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition ${
                  reason === r.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-surface"
                }`}
              >
                <span className="text-lg">{r.emoji}</span>
                <span className="text-sm font-semibold">{r.label}</span>
              </button>
            ))}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Conte mais (opcional)…"
            className="w-full bg-input rounded-2xl px-3 py-2 text-sm border border-transparent focus:border-primary outline-none resize-none"
            rows={3}
          />

          <button
            onClick={submit}
            disabled={!reason || busy}
            className="w-full mt-3 gradient-primary text-primary-foreground font-bold py-3 rounded-full glow-primary disabled:opacity-50 transition active:scale-95"
          >
            {busy ? "..." : "Enviar denúncia"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Em emergências, ligue 100 (Disque Direitos Humanos).
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
