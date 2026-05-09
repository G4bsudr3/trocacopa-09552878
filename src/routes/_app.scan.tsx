import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Repeat, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/scan")({
  head: () => ({ meta: [{ title: "Escanear figurinha — TrocaCopa" }] }),
  component: Scan,
});

type Scanned = { number: number; name: string; team: string; group: string };

const players = [
  { name: "Vinicius Jr.", team: "Brasil", group: "A" },
  { name: "Mbappé", team: "França", group: "C" },
  { name: "Bellingham", team: "Inglaterra", group: "B" },
  { name: "Yamal", team: "Espanha", group: "D" },
];

function Scan() {
  const [result, setResult] = useState<Scanned | null>(null);
  const [history, setHistory] = useState<Scanned[]>([]);

  const fakeScan = () => {
    const p = players[Math.floor(Math.random() * players.length)];
    const number = Math.floor(Math.random() * 640) + 1;
    const r = { ...p, number };
    setResult(r);
  };

  const mark = (kind: "owned" | "dup") => {
    if (!result) return;
    setHistory((h) => [result, ...h].slice(0, 6));
    toast.success(kind === "owned" ? "Figurinha adicionada ✅" : "Marcada como repetida 🔁");
    setResult(null);
  };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Escanear Figurinha</h1>

      {/* Camera mock */}
      <div className="mt-5 relative aspect-[3/4] rounded-3xl overflow-hidden glass-strong">
        <div className="absolute inset-0 bg-gradient-to-br from-surface to-background" />
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Frame corners */}
          <div className="relative w-[70%] h-[80%]">
            {[
              "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
              "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
            ].map((cls) => (
              <div key={cls} className={`absolute w-12 h-12 border-primary ${cls}`} />
            ))}
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-primary glow-primary"
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <Camera className="absolute inset-0 m-auto text-primary/40" size={64} />
          </div>
        </div>

        <div className="absolute bottom-5 inset-x-0 text-center px-6">
          <p className="text-sm text-muted-foreground mb-3">Aponte para a figurinha para identificar automaticamente</p>
          <button
            onClick={fakeScan}
            className="gradient-primary text-primary-foreground font-bold px-6 py-3 rounded-full glow-primary inline-flex items-center gap-2"
          >
            <Upload size={16} /> Simular escaneamento
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-5 mt-5">
          <div className="flex items-center gap-4">
            <div className="w-20 h-24 rounded-xl gradient-primary flex items-center justify-center font-display text-3xl text-primary-foreground glow-primary">
              #{result.number}
            </div>
            <div>
              <p className="font-bold text-lg">{result.name}</p>
              <p className="text-sm text-muted-foreground">{result.team}</p>
              <p className="text-xs text-gold font-semibold mt-1">Grupo {result.group}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => mark("owned")} className="gradient-primary text-primary-foreground rounded-full py-3 font-bold flex items-center justify-center gap-2">
              <Check size={16} /> Tenho
            </button>
            <button onClick={() => mark("dup")} className="bg-gold text-gold-foreground rounded-full py-3 font-bold flex items-center justify-center gap-2 glow-gold">
              <Repeat size={16} /> Repetida
            </button>
          </div>
        </motion.div>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl tracking-wide mb-3">Recentes</h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3">
                <span className="font-display text-xl text-primary">#{h.number}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.team}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
