import { createFileRoute } from "@tanstack/react-router";
import { Crown, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/pro")({
  head: () => ({ meta: [{ title: "TrocaCopa Pro" }] }),
  component: Pro,
});

const features = [
  { label: "Radar de colecionadores", free: "Até 10km", pro: "Ilimitado" },
  { label: "Escanear figurinhas", free: "20/dia", pro: "Ilimitado" },
  { label: "Chats simultâneos", free: "5", pro: "Ilimitados" },
  { label: "Localizar figurinha específica", free: false, pro: true },
  { label: "Match automático", free: false, pro: true },
  { label: "Notificações em tempo real", free: false, pro: true },
  { label: "Badge Pro no perfil", free: false, pro: true },
];

function Pro() {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("pro_waitlist").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setJoined(!!data));
  }, [user]);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("pro_waitlist").insert({ user_id: user.id } as any);
    setBusy(false);
    if (error && error.code !== "23505") return toast.error(error.message);
    setJoined(true);
    toast.success("Você está na lista! Avisaremos quando lançarmos. 💎");
  };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <div className="text-center mt-4">
        <span className="inline-flex w-16 h-16 rounded-2xl gradient-gold items-center justify-center glow-gold animate-float">
          <Crown size={32} className="text-gold-foreground" />
        </span>
        <h1 className="font-display text-4xl tracking-wide mt-3">
          TrocaCopa <span className="text-gold text-glow-gold">Pro</span> 🏆
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
          Encontre qualquer figurinha. Faça as trocas perfeitas. Complete seu álbum mais rápido.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Plan title="Grátis" highlight={false} />
        <Plan title="Pro" highlight={true} />
      </div>

      <div className="glass-strong rounded-3xl mt-3 overflow-hidden">
        {features.map((f, i) => (
          <div key={i} className={`grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center text-sm ${i % 2 ? "" : "bg-surface/30"}`}>
            <span>{f.label}</span>
            <span className="w-16 text-center text-xs text-muted-foreground">
              {typeof f.free === "boolean" ? (f.free ? <Check size={14} className="inline text-primary" /> : <X size={14} className="inline text-muted-foreground" />) : f.free}
            </span>
            <span className="w-16 text-center text-xs font-semibold text-gold">
              {typeof f.pro === "boolean" ? (f.pro ? <Check size={14} className="inline text-gold" /> : <X size={14} />) : f.pro}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={join}
        disabled={busy || joined}
        className="w-full mt-5 gradient-gold text-gold-foreground rounded-full py-4 font-bold glow-gold active:scale-95 transition disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : null}
        {joined ? "✓ Você está na lista" : "Quero ser avisado quando lançar"}
      </button>
      <p className="text-center text-xs text-muted-foreground mt-3">
        TrocaCopa Pro está em desenvolvimento. Sem cobranças por enquanto.
      </p>
    </div>
  );
}

function Plan({ title, highlight }: { title: string; highlight: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? "gradient-gold text-gold-foreground glow-gold" : "glass"}`}>
      <p className={`font-display text-2xl ${highlight ? "" : "text-foreground"}`}>{title}</p>
    </div>
  );
}
