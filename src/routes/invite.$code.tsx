import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({ meta: [{ title: "Convite — TrocaCopa" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!session) {
      try {
        localStorage.setItem("pendingInvite", code);
      } catch {
        // ignore
      }
      toast.info("Crie sua conta para virar amigo!");
      nav({ to: "/login" });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("accept_invite", { _code: code });
      if (error) {
        setStatus("error");
        setMsg(error.message);
        return;
      }
      const res = data as { ok?: boolean; error?: string; inviter_id?: string } | null;
      if (res?.ok) {
        try {
          localStorage.removeItem("pendingInvite");
        } catch {
          // ignore
        }
        toast.success("Vocês agora são amigos! 🎉");
        setStatus("done");
        setTimeout(() => nav({ to: "/near" }), 600);
      } else if (res?.error === "self_invite") {
        toast.info("Esse é o seu próprio convite 😉");
        nav({ to: "/profile" });
      } else {
        setStatus("error");
        setMsg(res?.error === "invalid_code" ? "Convite inválido ou expirado" : "Não foi possível processar o convite");
      }
    })();
  }, [loading, session, code, nav]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm text-muted-foreground mt-3">Validando convite…</p>
        </>
      )}
      {status === "done" && (
        <>
          <div className="text-5xl">🤝</div>
          <p className="font-display text-2xl mt-3">Amizade confirmada!</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-5xl">😕</div>
          <p className="font-display text-xl mt-3">{msg}</p>
        </>
      )}
    </div>
  );
}
