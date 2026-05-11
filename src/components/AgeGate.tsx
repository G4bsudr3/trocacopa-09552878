import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Cake, Shield, Mail, User as UserIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { computeAgeGroup, isMinor } from "@/lib/age";

const dobSchema = z.object({
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .refine((v) => {
      const d = new Date(v);
      return !isNaN(d.getTime()) && d < new Date() && d > new Date("1900-01-01");
    }, "Data inválida"),
  guardian_name: z.string().trim().max(80).optional(),
  guardian_email: z.string().trim().email("E-mail inválido").max(255).optional(),
});

/**
 * Modal bloqueante exibido para usuários antigos sem birth_date.
 * Após preencher: classifica o usuário; se menor, pede e-mail do responsável e cria pedido de consentimento.
 */
export function AgeGate() {
  const { profile, refreshProfile, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [step, setStep] = useState<"dob" | "guardian">("dob");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = !!profile && !profile.birth_date && !!user;

  useEffect(() => {
    if (open) {
      setBirthDate("");
      setGuardianEmail("");
      setGuardianName("");
      setStep("dob");
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const ag = birthDate ? computeAgeGroup(birthDate) : null;
  const willBeMinor = isMinor(ag);

  const handleSubmit = async () => {
    setErrors({});
    const payload: { birth_date: string; guardian_name?: string; guardian_email?: string } = {
      birth_date: birthDate,
    };
    if (willBeMinor) {
      payload.guardian_name = guardianName;
      payload.guardian_email = guardianEmail;
    }
    const parsed = dobSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    if (willBeMinor && (!guardianEmail || !guardianName)) {
      setErrors({
        guardian_email: !guardianEmail ? "Informe o e-mail do responsável" : "",
        guardian_name: !guardianName ? "Informe o nome do responsável" : "",
      });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          birth_date: birthDate,
          guardian_email: willBeMinor ? guardianEmail : null,
          guardian_name: willBeMinor ? guardianName : null,
        })
        .eq("id", user!.id);
      if (error) throw error;

      if (willBeMinor) {
        // cria pedido de consentimento
        const { error: cErr } = await supabase
          .from("guardian_consents")
          .insert({
            minor_user_id: user!.id,
            guardian_email: guardianEmail,
            guardian_name: guardianName,
          });
        if (cErr) throw cErr;
        toast.success("Tudo certo! Avisamos seu responsável por e-mail. 🛡️", { duration: 7000 });
      } else {
        toast.success("Obrigado! Seu perfil está completo. ⚽");
      }
      await refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!birthDate) {
      setErrors({ birth_date: "Informe sua data de nascimento" });
      return;
    }
    if (willBeMinor) setStep("guardian");
    else handleSubmit();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center px-5"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
              {step === "dob" ? <Cake size={22} className="text-primary-foreground" /> : <Shield size={22} className="text-primary-foreground" />}
            </div>
            <div>
              <h2 className="font-display text-2xl text-primary text-glow">
                {step === "dob" ? "Quantos anos você tem?" : "Precisamos do seu responsável"}
              </h2>
              <p className="text-xs text-muted-foreground">Para deixar o TrocaAI seguro pra você 🛡️</p>
            </div>
          </div>

          {step === "dob" ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground">Data de nascimento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className={`w-full bg-input rounded-2xl px-4 py-3 border ${errors.birth_date ? "border-destructive" : "border-transparent focus:border-primary"} outline-none text-sm`}
              />
              {errors.birth_date && <p className="text-xs text-destructive">{errors.birth_date}</p>}
              {willBeMinor && (
                <div className="text-xs bg-gold/10 border border-gold/30 rounded-2xl p-3 text-gold">
                  ⚽ Você é menor de idade — vamos pedir um OK rápido pro seu pai, mãe ou responsável. Sem isso, suas trocas e o mapa ficam pausados. Promete que é rapidinho!
                </div>
              )}
              <button
                onClick={next}
                disabled={busy}
                className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-full glow-primary disabled:opacity-60 transition active:scale-95"
              >
                Continuar →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Vamos enviar um e-mail pedindo a autorização do seu responsável. Enquanto ele não responder, você pode usar o álbum, mas trocas ficam pausadas.
              </p>
              <Field
                icon={<UserIcon size={18} />}
                placeholder="Nome do responsável"
                value={guardianName}
                onChange={setGuardianName}
                error={errors.guardian_name}
              />
              <Field
                icon={<Mail size={18} />}
                placeholder="E-mail do responsável"
                value={guardianEmail}
                onChange={setGuardianEmail}
                type="email"
                error={errors.guardian_email}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("dob")}
                  disabled={busy}
                  className="flex-1 glass border border-border py-3 rounded-full text-sm font-semibold"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={busy}
                  className="flex-1 gradient-primary text-primary-foreground font-bold py-3 rounded-full glow-primary disabled:opacity-60"
                >
                  {busy ? "..." : "Enviar 🛡️"}
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center mt-5">
            Conformidade com a Lei nº 15.211/2025 (ECA Digital)
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  icon, placeholder, value, onChange, type = "text", error,
}: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void; type?: string; error?: string }) {
  return (
    <div>
      <div className={`flex items-center gap-3 bg-input rounded-2xl px-4 py-3 border ${error ? "border-destructive" : "border-transparent focus-within:border-primary"}`}>
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
