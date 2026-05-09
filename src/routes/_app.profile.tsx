import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Edit3, LogOut, Crown, Star } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — TrocaCopa" }] }),
  component: Profile,
});

function Profile() {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  const trades = 24;
  const scanned = 187;
  const pct = 47;

  const badge = trades < 10 ? { icon: "🥉", name: "Iniciante" } : trades < 30 ? { icon: "🥈", name: "Colecionador" } : { icon: "🥇", name: "Mestre das Trocas" };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Perfil</h1>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 mt-4 text-center relative overflow-hidden">
        <div className="absolute -top-10 inset-x-0 h-32 gradient-hero opacity-20 blur-3xl" />
        <div className="w-24 h-24 mx-auto rounded-full gradient-primary flex items-center justify-center font-display text-4xl text-primary-foreground glow-primary relative">
          {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
        </div>
        <h2 className="font-display text-2xl mt-3">{profile?.full_name || "Colecionador"}</h2>
        <p className="text-sm text-muted-foreground">{profile?.city || "—"}</p>
        {profile?.plan === "pro" && (
          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full gradient-gold text-gold-foreground text-xs font-bold glow-gold">
            <Crown size={12} /> PRO
          </span>
        )}

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Stat n={trades} label="Trocas" />
          <Stat n={scanned} label="Escaneadas" />
          <Stat n={`${pct}%`} label="Álbum" />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-gold/30">
          <span className="text-2xl">{badge.icon}</span>
          <span className="font-semibold text-sm">{badge.name}</span>
        </div>
      </motion.div>

      {profile?.plan !== "pro" && (
        <Link to="/pro" className="block mt-4">
          <div className="rounded-2xl p-5 gradient-gold text-gold-foreground flex items-center gap-3 glow-gold">
            <Crown size={28} />
            <div className="flex-1">
              <p className="font-display text-xl">TrocaCopa Pro</p>
              <p className="text-xs">Desbloqueie radar ilimitado e match automático</p>
            </div>
            <span className="font-display text-2xl">→</span>
          </div>
        </Link>
      )}

      <section className="mt-6">
        <h3 className="font-display text-xl mb-3">Avaliações</h3>
        <div className="space-y-2">
          {[
            { name: "Maria S.", stars: 5, text: "Troca super tranquila e rápida!" },
            { name: "João L.", stars: 5, text: "Pessoa de confiança 🔥" },
            { name: "Pedro R.", stars: 4, text: "Boa, recomendo!" },
          ].map((r, i) => (
            <div key={i} className="glass rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.name}</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.stars }).map((_, s) => (
                    <Star key={s} size={12} className="fill-gold text-gold" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 mt-6">
        <button className="glass rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
          <Edit3 size={14} /> Editar Perfil
        </button>
        <button
          onClick={async () => { await signOut(); toast.success("Até logo!"); nav({ to: "/login" }); }}
          className="glass rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 text-destructive"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="bg-surface rounded-xl py-2">
      <p className="font-display text-2xl text-primary">{n}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
