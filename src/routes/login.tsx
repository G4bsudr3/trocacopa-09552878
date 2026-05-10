import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, MapPin, Cake, Shield } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { computeAgeGroup, isMinor } from "@/lib/age";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — TrocaCopa" },
      { name: "description", content: "Entre no TrocaCopa e troque figurinhas da Copa 2026." },
    ],
  }),
  component: LoginPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  city: z.string().trim().min(2, "Informe sua cidade").max(80),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Senha precisa ter pelo menos 8 caracteres").max(72),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .refine((v) => { const d = new Date(v); return !isNaN(d.getTime()) && d < new Date() && d > new Date("1900-01-01"); }, "Data inválida"),
  guardian_name: z.string().trim().max(80).optional().or(z.literal("")),
  guardian_email: z.string().trim().email("E-mail do responsável inválido").max(255).optional().or(z.literal("")),
});

const resetSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos";
  if (m.includes("user already registered")) return "Este e-mail já tem cadastro — faça login";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar";
  if (m.includes("rate limit")) return "Muitas tentativas, aguarde um instante";
  if (m.includes("password")) return "Senha não atende aos requisitos mínimos";
  return message;
}

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showReset, setShowReset] = useState(false);

  const ag = birthDate ? computeAgeGroup(birthDate) : null;
  const willBeMinor = isMinor(ag);

  if (!loading && session) return <Navigate to="/home" />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === "signup") {
      const parsed = signupSchema.safeParse({
        name, city, email, password, birth_date: birthDate,
        guardian_name: guardianName, guardian_email: guardianEmail,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
        setErrors(errs);
        return;
      }
      // Validate guardian fields if minor
      if (willBeMinor && (!guardianEmail || !guardianName)) {
        setErrors({
          guardian_email: !guardianEmail ? "Informe o e-mail do responsável" : "",
          guardian_name: !guardianName ? "Informe o nome do responsável" : "",
        });
        return;
      }
      setBusy(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: {
              full_name: parsed.data.name,
              city: parsed.data.city,
              birth_date: parsed.data.birth_date,
              ...(willBeMinor ? { guardian_name: guardianName, guardian_email: guardianEmail } : {}),
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          await supabase
            .from("profiles")
            .update({
              full_name: parsed.data.name,
              city: parsed.data.city,
              birth_date: parsed.data.birth_date,
              ...(willBeMinor ? { guardian_email: guardianEmail, guardian_name: guardianName } : {}),
            })
            .eq("id", data.session.user.id);

          if (willBeMinor) {
            await supabase.from("guardian_consents").insert({
              minor_user_id: data.session.user.id,
              guardian_email: guardianEmail,
              guardian_name: guardianName,
            });
            toast.success("Conta criada! 🛡️ Avisamos seu responsável por e-mail. Algumas funções ficam pausadas até a aprovação.", { duration: 9000 });
          } else {
            toast.success("Conta criada! Bem-vindo ao TrocaCopa ⚽");
          }
          navigate({ to: "/home" });
        } else {
          toast.success(`Enviamos um e-mail de confirmação para ${parsed.data.email}. Confirme para entrar.`, {
            duration: 8000,
          });
          setPassword("");
          setMode("signin");
        }
      } catch (err: any) {
        toast.error(translateAuthError(err.message || "Algo deu errado"));
      } finally {
        setBusy(false);
      }
      return;
    }

    const parsed = signinSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/home" });
    } catch (err: any) {
      toast.error(translateAuthError(err.message || "Algo deu errado"));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0].message });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para seu e-mail.", { duration: 7000 });
      setShowReset(false);
    } catch (err: any) {
      toast.error(translateAuthError(err.message || "Não foi possível enviar"));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/home`,
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
              onClick={() => { setMode(m); setErrors({}); setShowReset(false); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        {showReset ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
            <Field
              icon={<Mail size={18} />}
              placeholder="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              error={errors.email}
            />
            <button
              onClick={handleReset}
              disabled={busy}
              className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-full glow-primary disabled:opacity-60 transition active:scale-95"
            >
              {busy ? "..." : "Enviar link de recuperação"}
            </button>
            <button
              onClick={() => { setShowReset(false); setErrors({}); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Voltar para login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmail} className="space-y-3">
              {mode === "signup" && (
                <>
                  <Field icon={<UserIcon size={18} />} placeholder="Seu nome" value={name} onChange={setName} error={errors.name} />
                  <Field icon={<MapPin size={18} />} placeholder="Cidade / região" value={city} onChange={setCity} error={errors.city} />
                </>
              )}
              <Field icon={<Mail size={18} />} placeholder="E-mail" value={email} onChange={setEmail} type="email" error={errors.email} />
              <Field icon={<Lock size={18} />} placeholder="Senha" value={password} onChange={setPassword} type="password" error={errors.password} />

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setShowReset(true); setErrors({}); }}
                  className="text-xs text-primary hover:underline w-full text-right"
                >
                  Esqueci minha senha
                </button>
              )}

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
          </>
        )}
      </motion.div>
    </div>
  );
}

function Field({
  icon, placeholder, value, onChange, type = "text", error,
}: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string; error?: string }) {
  return (
    <div>
      <div className={`flex items-center gap-3 bg-input rounded-2xl px-4 py-3 border transition ${error ? "border-destructive" : "border-transparent focus-within:border-primary"}`}>
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1 ml-2">{error}</p>}
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
