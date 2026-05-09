import { createFileRoute } from "@tanstack/react-router";
import { Crown, Check, X } from "lucide-react";
import { toast } from "sonner";

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
        onClick={() => toast.success("Em breve! 💎")}
        className="w-full mt-5 gradient-gold text-gold-foreground rounded-full py-4 font-bold glow-gold active:scale-95 transition"
      >
        Assinar TrocaCopa Pro — R$ 9,90/mês
      </button>
      <p className="text-center text-xs text-muted-foreground mt-3">Cancele quando quiser</p>
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
