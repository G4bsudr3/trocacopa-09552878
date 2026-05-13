import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTheme } from "@/lib/use-theme";
import logoBranca from "@/assets/logo-branca.png";
import logoPreta from "@/assets/logo-preta.png";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, User as UserIcon, Cake, Shield, Eye, EyeOff, Loader2, AlertTriangle, Copy } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { computeAgeGroup, isMinor } from "@/lib/age";
import { Link } from "@tanstack/react-router";
import { LocationSelect } from "@/components/location-select";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

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

// Detecta navegadores embutidos (WebView dentro de Instagram, FB, TikTok, LinkedIn, Gmail etc.)
// onde o Google bloqueia OAuth com a política "Use navegadores seguros".
function detectInAppBrowser(): { isInApp: boolean; appName: string | null } {
  if (typeof navigator === "undefined") return { isInApp: false, appName: null };
  const ua = navigator.userAgent || "";
  const checks: Array<[RegExp, string]> = [
    [/Instagram/i, "Instagram"],
    [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
    [/Messenger/i, "Messenger"],
    [/Twitter/i, "Twitter/X"],
    [/Line\//i, "LINE"],
    [/MicroMessenger/i, "WeChat"],
    [/TikTok|musical_ly|Bytedance/i, "TikTok"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Snapchat/i, "Snapchat"],
    [/Pinterest/i, "Pinterest"],
    [/GSA\//i, "Google App"],
    [/KAKAOTALK/i, "KakaoTalk"],
  ];
  for (const [re, name] of checks) if (re.test(ua)) return { isInApp: true, appName: name };
  // iOS WebView genérico (sem Safari token) — geralmente embutido
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS && !/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) {
    return { isInApp: true, appName: "outro app" };
  }
  return { isInApp: false, appName: null };
}

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
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
  const [inApp] = useState(() => detectInAppBrowser());

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado! Cole no Safari para entrar com Google.");
    } catch {
      toast.error("Não consegui copiar — copie manualmente da barra de endereço.");
    }
  };

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
    if (inApp.isInApp) {
      toast.error(
        `O Google bloqueia login dentro do ${inApp.appName ?? "app"}. Abra no Safari/Chrome para continuar.`,
        { duration: 6000 },
      );
      return;
    }
    setBusy(true);

    if (Capacitor.isNativePlatform()) {
      // Native Android: Google blocks OAuth in WebViews — open Chrome instead
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "trocacopa://auth/callback",
          skipBrowserRedirect: true,
        },
      });
      setBusy(false);
      if (error || !data.url) return toast.error("Erro ao iniciar login com Google");
      await Browser.open({ url: data.url });
      return;
    }

    // Web
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <img
          src={theme === "dark" ? logoBranca : logoPreta}
          alt=""
          className="h-20 md:h-24 object-contain mx-auto"
        />
        <div className="font-brand text-5xl md:text-6xl font-black leading-none tracking-tight mt-1">
          Troca<span className="text-gold">Copa</span>
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Copa do Mundo 2026</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="w-full max-w-sm glass-strong rounded-2xl p-6 shadow-card"
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

        {inApp.isInApp && !Capacitor.isNativePlatform() && (
          <div className="mb-5 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs space-y-2">
            <div className="flex items-start gap-2 text-gold">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="font-semibold leading-snug">
                Você abriu pelo {inApp.appName ?? "outro app"}. O Google bloqueia login aqui dentro.
              </p>
            </div>
            <p className="text-muted-foreground leading-snug">
              Para usar <strong>Entrar com Google</strong>, abra este link no Safari ou Chrome.
              Você também pode entrar normalmente por <strong>e-mail e senha</strong> abaixo.
            </p>
            <button
              onClick={copyLink}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-surface-elevated border border-border py-2 font-semibold hover:bg-surface transition active:scale-95"
            >
              <Copy size={13} /> Copiar link para abrir no Safari
            </button>
          </div>
        )}

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
              {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Enviar link de recuperação"}
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
                  <Field icon={<UserIcon size={18} />} placeholder="Seu nome" value={name} onChange={setName} error={errors.name} autoComplete="name" />
                  <LocationSelect value={city} onChange={setCity} error={errors.city} />
                  <DateField icon={<Cake size={18} />} value={birthDate} onChange={setBirthDate} error={errors.birth_date} />
                  {willBeMinor && (
                    <div className="rounded-2xl bg-gold/10 border border-gold/30 p-3 space-y-2">
                      <p className="text-[11px] text-gold font-bold flex items-center gap-1.5">
                        <Shield size={12} /> Menor de 18 — autorização do responsável
                      </p>
                      <Field icon={<UserIcon size={18} />} placeholder="Nome do responsável" value={guardianName} onChange={setGuardianName} error={errors.guardian_name} />
                      <Field icon={<Mail size={18} />} placeholder="E-mail do responsável" value={guardianEmail} onChange={setGuardianEmail} type="email" error={errors.guardian_email} autoComplete="email" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Acesso</span>
                    <div className="h-px bg-border flex-1" />
                  </div>
                </>
              )}
              <Field icon={<Mail size={18} />} placeholder="E-mail" value={email} onChange={setEmail} type="email" error={errors.email} autoComplete={mode === "signup" ? "email" : "username"} />
              <Field icon={<Lock size={18} />} placeholder="Senha" value={password} onChange={setPassword} type="password" error={errors.password} autoComplete={mode === "signup" ? "new-password" : "current-password"} />

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
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : mode === "signin" ? "Entrar" : "Criar conta"}
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

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6">
        <Link to="/seguranca" className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          🛡️ Segurança e crianças
        </Link>
        <Link to="/termos" className="text-[11px] text-muted-foreground hover:text-primary">
          Termos de Uso
        </Link>
        <Link to="/privacidade" className="text-[11px] text-muted-foreground hover:text-primary">
          Privacidade
        </Link>
      </div>
    </main>
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

function DateField({
  icon, value, onChange, error,
}: { icon: React.ReactNode; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Data de nascimento</label>
      <div className={`flex items-center gap-3 bg-input rounded-2xl px-4 py-3 border transition ${error ? "border-destructive" : "border-transparent focus-within:border-primary"}`}>
        <span className="text-muted-foreground">{icon}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>
      {!error && <p className="text-[10px] text-muted-foreground mt-1 ml-2">Exigido pela Lei nº 15.211/2025</p>}
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
