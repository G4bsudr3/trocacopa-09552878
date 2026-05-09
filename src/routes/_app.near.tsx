import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, MapPin } from "lucide-react";
import { mockCollectors } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/near")({
  head: () => ({ meta: [{ title: "Perto de mim — TrocaCopa" }] }),
  component: Near,
});

function Near() {
  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Perto de Mim</h1>
      <p className="text-sm text-muted-foreground">Colecionadores na sua região</p>

      {/* Map placeholder */}
      <div className="mt-4 h-56 rounded-3xl glass-strong relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,oklch(0.78_0.22_152)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,oklch(0.86_0.16_92)_0%,transparent_40%)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/20 animate-ping absolute" />
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary relative">
              <MapPin className="text-primary-foreground" />
            </div>
          </div>
        </div>
        {mockCollectors.slice(0, 4).map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 + 0.3 }}
            className="absolute w-9 h-9 rounded-full gradient-gold flex items-center justify-center text-xs font-bold text-gold-foreground glow-gold"
            style={{
              top: `${20 + (i * 15) % 60}%`,
              left: `${15 + (i * 23) % 70}%`,
            }}
          >
            {c.avatar}
          </motion.div>
        ))}
      </div>

      <h2 className="font-display text-xl tracking-wide mt-6 mb-3">Ordenado por compatibilidade</h2>
      <div className="space-y-3">
        {mockCollectors.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground shrink-0">
                {c.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.city} · ~{c.distanceKm} km</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl text-primary text-glow leading-none">{c.match}%</p>
                <p className="text-[10px] text-gold uppercase tracking-wider">match 🔥</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tem <span className="text-primary font-semibold">{c.has.length}</span> que você precisa · precisa <span className="text-gold font-semibold">{c.needs.length}</span> que você tem
              </p>
            </div>
            <Link
              to="/trade/$id" params={{ id: c.id }}
              className="mt-3 w-full gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} /> Iniciar Troca
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
