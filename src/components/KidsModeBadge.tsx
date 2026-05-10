import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function KidsModeBadge({ className = "" }: { className?: string }) {
  const { profile } = useAuth();
  if (!profile?.kids_mode) return null;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-[10px] font-bold uppercase tracking-wider ${className}`}>
      <Shield size={11} /> Modo Kids
    </div>
  );
}

/** Banner persistente no topo de telas sensíveis (trade, scan) para menores. */
export function KidsModeBanner() {
  const { profile } = useAuth();
  if (!profile?.kids_mode) return null;
  return (
    <div className="mx-3 mb-3 rounded-2xl bg-gold/10 border border-gold/30 p-3 flex items-start gap-3">
      <Shield size={18} className="text-gold flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-xs font-bold text-gold">Modo Kids ativo</p>
        <p className="text-[11px] text-foreground/80 mt-0.5">
          Combine trocas sempre em local público e com um responsável por perto. Não compartilhe endereço, telefone ou redes sociais.
        </p>
      </div>
    </div>
  );
}
