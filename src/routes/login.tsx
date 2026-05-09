import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — TrocaCopa" },
      { name: "description", content: "Entre no TrocaCopa e troque figurinhas da Copa 2026." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/home" />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: name,
            city,
          });
        }
        toast.success("Conta criada! Bem-vindo ao TrocaCopa ⚽");
        navigate({ to: "/home" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/home" });
      }
    } catch (err: any) {
      toast.error(err.message || "Algo deu errado");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Erro ao entrar com Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      {/* bg glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-gold/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="font-display text-6xl md:text-7xl text-primary text-glow tracking-wide">
          ⚽ TROCACOPA
        </h1>
        <p className="text-gold font-display text-xl tracking-widest mt-1">COPA DO MUNDO 2026</p>
        <p className="text-muted-foreground mt-4 text-sm md:text-base max-w-xs">
          Troque figurinhas com quem está perto de você
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm glass-strong rounded-3xl p-6 shadow-card"
      >
        <div className="flex gap-2 p-1 bg-surface rounded-full mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field icon={<UserIcon size={18} />} placeholder="Seu nome" value={name} onChange={setName} />
              <Field icon={<UserIcon size={18} />} placeholder="Cidade / região" value={city} onChange={setCity} />
            </>
          )}
          <Field icon={<Mail size={18} />} placeholder="E-mail" value={email} onChange={setEmail} type="email" />
          <Field icon={<Lock size={18} />} placeholder="Senha" value={password} onChange={setPassword} type="password" />

          <button
            type="submit"
            disabled={busy}
            className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-full glow-primary disabled:opacity-60 transition active:scale-95"
          >
            {busy ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-border flex-1" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full glass border border-border rounded-full py-3.5 font-semibold text-sm flex items-center justify-center gap-3 hover:bg-surface-elevated transition active:scale-95"
        >
          <GoogleIcon /> Entrar com Google
        </button>
      </motion.div>
    </div>
  );
}

function Field({
  icon, placeholder, value, onChange, type = "text",
}: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center gap-3 bg-input rounded-2xl px-4 py-3 border border-transparent focus-within:border-primary transition">
      <span className="text-muted-foreground">{icon}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.92-2.26c-.8.55-1.84.87-3.03.87-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.73c-.18-.55-.28-1.13-.28-1.73s.1-1.18.28-1.73V4.94H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.06l3.05-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.94l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
