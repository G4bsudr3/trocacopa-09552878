import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — TrocaCopa" }] }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "Senha precisa ter pelo menos 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Supabase coloca o token na URL hash; auth client processa automaticamente
    // e dispara PASSWORD_RECOVERY. Também aceitamos sessão recém-criada.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Senha atualizada! Faça login novamente.");
      nav({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar a senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm glass-strong rounded-3xl p-6 shadow-card"
      >
        <h1 className="font-display text-3xl text-primary text-glow text-center">Nova senha</h1>
        <p className="text-sm text-muted-foreground text-center mt-2 mb-5">
          Defina uma nova senha para sua conta.
        </p>

        {!ready ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground text-center">
              Verificando link de recuperação... Se isso persistir, solicite um novo link.
            </p>
            <Link to="/login" className="text-xs text-primary hover:underline mt-2">
              ← Voltar para login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field
              icon={<Lock size={18} />}
              placeholder="Nova senha"
              value={password}
              onChange={setPassword}
              type="password"
              error={errors.password}
              autoComplete="new-password"
            />
            <Field
              icon={<Lock size={18} />}
              placeholder="Confirmar senha"
              value={confirm}
              onChange={setConfirm}
              type="password"
              error={errors.confirm}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-full glow-primary disabled:opacity-60 transition active:scale-95"
            >
              {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Atualizar senha"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function Field({
  icon, placeholder, value, onChange, type = "text", error, autoComplete,
}: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string; error?: string; autoComplete?: string }) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <div className={`flex items-center gap-3 bg-input rounded-2xl px-4 py-3 border transition ${error ? "border-destructive" : "border-transparent focus-within:border-primary"}`}>
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={isPassword && showPwd ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-muted-foreground hover:text-foreground transition shrink-0">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1 ml-2">{error}</p>}
    </div>
  );
}
