import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/consent/$token")({
  head: () => ({
    meta: [
      { title: "Autorização do responsável — TrocaAI" },
      { name: "description", content: "Aprove o uso do TrocaAI por um menor sob sua responsabilidade." },
    ],
  }),
  component: ConsentPage,
});

type Lookup = {
  minor_user_id: string;
  minor_name: string | null;
  minor_birth_date: string | null;
  guardian_email: string;
  requested_at: string;
  approved_at: string | null;
  revoked_at: string | null;
  expires_at: string;
};

function ConsentPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Lookup | null | "missing">(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"approved" | "revoked" | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("guardian_consent_lookup", { _token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setData("missing");
      } else {
        setData(Array.isArray(data) ? data[0] as Lookup : data as Lookup);
      }
    })();
  }, [token]);

  const approve = async () => {
    setBusy(true);
    const { data: ok, error } = await supabase.rpc("guardian_consent_approve", { _token: token });
    setBusy(false);
    if (error || !ok) { toast.error("Link inválido ou expirado"); return; }
    setDone("approved");
  };
  const revoke = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("guardian_consent_revoke", { _token: token });
    setBusy(false);
    if (error) { toast.error("Não foi possível registrar"); return; }
    setDone("revoked");
  };

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (data === "missing") {
    return (
      <Centered>
        <h1 className="font-display text-3xl text-destructive mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este pedido pode ter expirado ou já ter sido respondido.</p>
      </Centered>
    );
  }

  const expired = new Date(data.expires_at) < new Date();
  const alreadyDone = !!data.approved_at || !!data.revoked_at;

  return (
    <Centered>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
            <Shield className="text-primary-foreground" size={22} />
          </div>
          <div>
            <h1 className="font-display text-2xl text-primary text-glow">Autorização parental</h1>
            <p className="text-xs text-muted-foreground">TrocaAI · ECA Digital</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 mb-4 space-y-1 text-sm">
          <p><span className="text-muted-foreground">Menor:</span> <strong>{data.minor_name || "—"}</strong></p>
          {data.minor_birth_date && (
            <p><span className="text-muted-foreground">Nascimento:</span> {new Date(data.minor_birth_date).toLocaleDateString("pt-BR")}</p>
          )}
          <p><span className="text-muted-foreground">Pedido:</span> {new Date(data.requested_at).toLocaleString("pt-BR")}</p>
        </div>

        {done === "approved" || (alreadyDone && data.approved_at) ? (
          <div className="text-center py-4">
            <Check className="mx-auto text-primary mb-2" size={36} />
            <p className="font-bold">Autorização registrada ✓</p>
            <p className="text-xs text-muted-foreground mt-1">Você pode revogar a qualquer momento usando o mesmo link.</p>
            {!data.revoked_at && (
              <button onClick={revoke} disabled={busy} className="mt-4 text-xs text-destructive underline">
                Revogar autorização
              </button>
            )}
          </div>
        ) : done === "revoked" || data.revoked_at ? (
          <div className="text-center py-4">
            <X className="mx-auto text-destructive mb-2" size={36} />
            <p className="font-bold">Autorização revogada</p>
            <p className="text-xs text-muted-foreground mt-1">A conta do menor ficou pausada.</p>
          </div>
        ) : expired ? (
          <p className="text-center text-destructive text-sm py-4">Este pedido expirou.</p>
        ) : (
          <>
            <p className="text-sm mb-4">
              O TrocaAI é um aplicativo para colecionar e trocar figurinhas da Copa 2026. Ao autorizar, você confirma que conhece o uso e aceita que o menor:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 mb-4 list-disc list-inside">
              <li>Tenha um perfil em <strong>Modo Kids</strong> (privacidade reforçada, sem localização exata, sem aparecer em buscas públicas)</li>
              <li>Faça trocas <strong>apenas com outros menores</strong></li>
              <li>Não receba mensagens de adultos desconhecidos</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={revoke}
                disabled={busy}
                className="flex-1 glass border border-destructive/40 text-destructive py-3 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                Não autorizo
              </button>
              <button
                onClick={approve}
                disabled={busy}
                className="flex-1 gradient-primary text-primary-foreground font-bold py-3 rounded-full glow-primary disabled:opacity-50"
              >
                {busy ? "..." : "Autorizo ✓"}
              </button>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-5">
          Lei nº 15.211/2025 — ECA Digital. Dúvidas: suporte@TrocaAI.com
        </p>
      </motion.div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 bg-background">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}
