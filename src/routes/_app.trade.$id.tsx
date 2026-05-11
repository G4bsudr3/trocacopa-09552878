import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, X, Loader2, CalendarClock, MapPin, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/trade/$id")({
  head: () => ({ meta: [{ title: "Troca — TrocaCopa" }] }),
  component: Trade,
});

type TradeRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  offered_stickers: string[];
  requested_stickers: string[];
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  created_at: string;
  meet_at: string | null;
  meet_place: string | null;
  meet_status: "proposed" | "confirmed" | "cancelled" | null;
  meet_proposed_by: string | null;
};

type Message = {
  id: string;
  trade_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function Trade() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [confettiOn, setConfettiOn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const trade = useQuery({
    queryKey: ["trade", id],
    queryFn: async (): Promise<TradeRow | null> => {
      const { data, error } = await supabase.from("trades").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as TradeRow | null;
    },
  });

  const otherId = trade.data
    ? trade.data.requester_id === user?.id
      ? trade.data.receiver_id
      : trade.data.requester_id
    : null;

  const otherProfile = useQuery({
    queryKey: ["profile", otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,city,avatar_url,plan")
        .eq("id", otherId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Initial messages load + realtime
  useEffect(() => {
    let mounted = true;
    supabase
      .from("trade_messages")
      .select("*")
      .eq("trade_id", id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (mounted) setMessages((data ?? []) as Message[]);
      });

    const channel = supabase
      .channel(`trade-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trade_messages", filter: `trade_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trades", filter: `id=eq.${id}` },
        () => trade.refetch()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("trade_messages")
      .insert({ trade_id: id, sender_id: user.id, content });
    if (error) {
      toast.error(error.message);
      setText(content);
    }
  };

  const updateStatus = async (status: TradeRow["status"]) => {
    if (status === "completed") {
      const ok = window.confirm("Confirmar que a troca foi realizada presencialmente?");
      if (!ok) return;
    }
    const { error } = await supabase.from("trades").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "completed") {
      setConfettiOn(true);
      toast.success("Troca concluída! 🎉");
      setTimeout(() => setConfettiOn(false), 4000);
    } else if (status === "accepted") toast.success("Troca aceita");
    else if (status === "declined") toast.success("Troca recusada");
    else if (status === "cancelled") toast.success("Troca cancelada");
  };

  if (trade.isLoading) {
    return (
      <div className="px-5 pt-10 max-w-3xl mx-auto flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!trade.data) {
    return (
      <div className="px-5 pt-10 max-w-3xl mx-auto text-center">
        <p>Troca não encontrada.</p>
        <Link to="/trades" className="text-primary underline mt-3 inline-block">Voltar para Minhas Trocas</Link>
      </div>
    );
  }

  const t = trade.data;
  const isReceiver = user?.id === t.receiver_id;
  const otherName = otherProfile.data?.full_name || "Colecionador";

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto pb-6">
      <Link to="/trades" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="glass-strong rounded-2xl p-4 mt-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground">
          {otherProfile.data?.avatar_url ? (
            <img src={otherProfile.data.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            (otherName[0] || "?").toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{otherName}</p>
          <p className="text-xs text-muted-foreground">{otherProfile.data?.city || "—"}</p>
        </div>
        <StatusBadge status={t.status} />
      </div>

      {t.status === "pending" && isReceiver && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => updateStatus("accepted")}
            className="gradient-primary text-primary-foreground rounded-full py-2.5 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Check size={14} /> Aceitar
          </button>
          <button
            onClick={() => updateStatus("declined")}
            className="glass border border-destructive/30 text-destructive rounded-full py-2.5 font-bold text-sm flex items-center justify-center gap-2"
          >
            <X size={14} /> Recusar
          </button>
        </div>
      )}

      {t.status === "accepted" && (
        <button
          onClick={() => updateStatus("completed")}
          className="w-full mt-3 gradient-primary text-primary-foreground rounded-full py-3 font-bold glow-primary flex items-center justify-center gap-2"
        >
          <Check size={16} /> Marcar como concluída
        </button>
      )}

      {(t.status === "accepted" || t.status === "pending") && (
        <MeetBlock trade={t} meId={user?.id ?? ""} onChange={() => trade.refetch()} />
      )}

      {/* Chat */}
      <div className="glass-strong rounded-3xl mt-5 p-4 flex flex-col">
        <p className="font-display text-lg mb-3">Combinem o encontro</p>
        <div ref={scrollRef} className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-6">
              Sem mensagens ainda. Diga oi! 👋
            </p>
          )}
          {messages.map((m) => {
            const me = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                    me ? "gradient-primary text-primary-foreground" : "bg-surface"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Mensagem..."
            maxLength={500}
            className="flex-1 bg-input rounded-full px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confettiOn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
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

function StatusBadge({ status }: { status: TradeRow["status"] }) {
  const map: Record<TradeRow["status"], { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-gold/20 text-gold border-gold/40" },
    accepted: { label: "Aceita", cls: "bg-primary/20 text-primary border-primary/40" },
    declined: { label: "Recusada", cls: "bg-destructive/20 text-destructive border-destructive/40" },
    completed: { label: "Concluída", cls: "bg-primary/30 text-primary border-primary/50" },
    cancelled: { label: "Cancelada", cls: "bg-surface text-muted-foreground border-border" },
  };
  const m = map[status];
  return <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${m.cls}`}>{m.label}</span>;
}

function MeetBlock({
  trade,
  meId,
  onChange,
}: {
  trade: TradeRow;
  meId: string;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(trade.meet_at ? trade.meet_at.slice(0, 10) : "");
  const [time, setTime] = useState(trade.meet_at ? trade.meet_at.slice(11, 16) : "");
  const [place, setPlace] = useState(trade.meet_place ?? "");
  const [busy, setBusy] = useState(false);

  const hasMeet = !!trade.meet_at;
  const otherProposed = trade.meet_proposed_by && trade.meet_proposed_by !== meId;
  const cancelled = trade.meet_status === "cancelled";

  const save = async () => {
    if (!date || !time) {
      toast.error("Escolha data e horário");
      return;
    }
    setBusy(true);
    const meetAt = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase
      .from("trades")
      .update({
        meet_at: meetAt,
        meet_place: place.trim() || null,
        meet_status: "proposed",
        meet_proposed_by: meId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trade.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Encontro proposto! Aguardando confirmação.");
    setEditing(false);
    onChange();
  };

  const confirm = async () => {
    const { error } = await supabase
      .from("trades")
      .update({ meet_status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", trade.id);
    if (error) return toast.error(error.message);
    toast.success("Encontro confirmado! 📍");
    onChange();
  };

  const cancel = async () => {
    const { error } = await supabase
      .from("trades")
      .update({ meet_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", trade.id);
    if (error) return toast.error(error.message);
    toast.success("Encontro cancelado");
    onChange();
  };

  if (editing || (!hasMeet && trade.status === "accepted")) {
    return (
      <div className="glass-strong rounded-3xl mt-4 p-4">
        <p className="font-display text-lg flex items-center gap-2">
          <CalendarClock size={18} /> {hasMeet ? "Remarcar encontro" : "Marcar encontro"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Escolha quando e onde se encontrar para trocar.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="bg-input rounded-xl px-3 py-2.5 text-sm outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-input rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <input
          type="text"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Local (ex: Praça da Sé, Shopping...)"
          maxLength={120}
          className="w-full mt-2 bg-input rounded-xl px-3 py-2.5 text-sm outline-none"
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          {hasMeet && (
            <button
              onClick={() => setEditing(false)}
              className="glass rounded-full py-2.5 text-sm font-semibold"
            >
              Cancelar edição
            </button>
          )}
          <button
            onClick={save}
            disabled={busy}
            className={`gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-bold disabled:opacity-50 ${hasMeet ? "" : "col-span-2"}`}
          >
            {busy ? "Salvando..." : hasMeet ? "Salvar nova proposta" : "Propor encontro"}
          </button>
        </div>
      </div>
    );
  }

  if (!hasMeet) {
    return (
      <div className="glass-strong rounded-3xl mt-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Aceitem a troca para combinar data, horário e local do encontro.
        </p>
      </div>
    );
  }

  const meetDate = new Date(trade.meet_at!);
  const fmt = meetDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const hour = meetDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`glass-strong rounded-3xl mt-4 p-4 border ${cancelled ? "border-border" : trade.meet_status === "confirmed" ? "border-primary/40" : "border-gold/40"}`}>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg flex items-center gap-2">
          <CalendarClock size={18} /> Encontro
        </p>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          cancelled ? "bg-surface text-muted-foreground" :
          trade.meet_status === "confirmed" ? "bg-primary/20 text-primary" : "bg-gold/20 text-gold"
        }`}>
          {cancelled ? "Cancelado" : trade.meet_status === "confirmed" ? "Confirmado" : "Aguardando"}
        </span>
      </div>
      <p className="text-base font-semibold mt-2 capitalize">{fmt} às {hour}</p>
      {trade.meet_place && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
          <MapPin size={14} /> {trade.meet_place}
        </p>
      )}

      {!cancelled && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {otherProposed && trade.meet_status === "proposed" && (
            <button
              onClick={confirm}
              className="gradient-primary text-primary-foreground rounded-full py-2 text-sm font-bold flex items-center justify-center gap-1"
            >
              <Check size={14} /> Confirmar
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className={`glass rounded-full py-2 text-sm font-semibold flex items-center justify-center gap-1 ${otherProposed && trade.meet_status === "proposed" ? "" : "col-span-1"}`}
          >
            <Edit3 size={14} /> Remarcar
          </button>
          <button
            onClick={cancel}
            className={`glass border border-destructive/30 text-destructive rounded-full py-2 text-sm font-semibold ${otherProposed && trade.meet_status === "proposed" ? "col-span-2" : ""}`}
          >
            Cancelar encontro
          </button>
        </div>
      )}

      {cancelled && (
        <button
          onClick={() => setEditing(true)}
          className="w-full mt-3 gradient-primary text-primary-foreground rounded-full py-2 text-sm font-bold"
        >
          Propor novo horário
        </button>
      )}
    </div>
  );
}
