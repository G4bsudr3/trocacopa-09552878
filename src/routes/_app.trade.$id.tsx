import { createFileRoute, Link } from "@tanstack/react-router";
import { mockCollectors } from "@/lib/mock-data";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/trade/$id")({
  head: () => ({ meta: [{ title: "Troca — TrocaCopa" }] }),
  component: Trade,
});

function Trade() {
  const { id } = Route.useParams();
  const collector = mockCollectors.find((c) => c.id === id) ?? mockCollectors[0];
  const [confirmed, setConfirmed] = useState(false);
  const [messages, setMessages] = useState<{ me: boolean; t: string }[]>([
    { me: false, t: "Oi! Vi que você tem a #47 que eu preciso 👀" },
  ]);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMessages([...messages, { me: true, t: text }]);
    setText("");
  };

  const confirm = () => {
    setConfirmed(true);
    toast.success("Troca combinada! Bom proveito! ⚽🎉");
  };

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto pb-6">
      <Link to="/near" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="glass-strong rounded-2xl p-4 mt-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground">
          {collector.avatar}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{collector.name}</p>
          <p className="text-xs text-muted-foreground">{collector.city}</p>
        </div>
        <span className="font-display text-2xl text-primary text-glow">{collector.match}%</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Side title="Você oferece" nums={collector.needs} color="primary" />
        <Side title="Ele oferece" nums={collector.has} color="gold" />
      </div>

      <button
        onClick={confirm}
        disabled={confirmed}
        className="w-full mt-4 gradient-primary text-primary-foreground rounded-full py-3.5 font-bold glow-primary disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2"
      >
        <Check size={16} /> {confirmed ? "Troca Confirmada!" : "Confirmar Troca"}
      </button>

      {/* Chat */}
      <div className="glass-strong rounded-3xl mt-5 p-4">
        <p className="font-display text-lg mb-3">Combinem o encontro</p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${m.me ? "gradient-primary text-primary-foreground" : "bg-surface"}`}>
                {m.t}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Mensagem..."
            className="flex-1 bg-input rounded-full px-4 py-2 text-sm outline-none"
          />
          <button onClick={send} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground">
            <Send size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confirmed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: -50, x: `${Math.random() * 100}%`, rotate: 0, opacity: 1 }}
                animate={{ y: "110vh", rotate: 720 }}
                transition={{ duration: 2 + Math.random() * 2, ease: "easeIn" }}
                className="absolute text-2xl"
              >
                {["⚽", "🎉", "🏆", "✨"][i % 4]}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Side({ title, nums, color }: { title: string; nums: number[]; color: "primary" | "gold" }) {
  return (
    <div className="glass rounded-2xl p-3">
      <p className="text-xs text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {nums.map((n) => (
          <span
            key={n}
            className={`font-display text-sm px-2 py-1 rounded-lg ${
              color === "primary" ? "bg-primary/20 text-primary border border-primary/40" : "bg-gold/20 text-gold border border-gold/40"
            }`}
          >
            #{n}
          </span>
        ))}
      </div>
    </div>
  );
}
