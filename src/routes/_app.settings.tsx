import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronRight, User, MapPin, Crown, LogOut, Trash2, Loader2, Eye, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Configurações — TrocaCopa" }] }),
  component: Settings,
});

type Prefs = { trades?: boolean; messages?: boolean; matches?: boolean };

const APP_VERSION = "1.0.0";

function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const prefs = (profile?.notification_prefs as Prefs) ?? { trades: true, messages: true, matches: true };
  const discoverable = (profile as any)?.discoverable !== false;

  const updatePref = async (k: keyof Prefs, v: boolean) => {
    if (!user) return;
    const next = { ...prefs, [k]: v };
    const { error } = await supabase.from("profiles").update({ notification_prefs: next }).eq("id", user.id);
    if (error) return toast.error(error.message);
    refreshProfile();
  };

  const setDiscoverable = async (v: boolean) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ discoverable: v } as any).eq("id", user.id);
    if (error) return toast.error(error.message);
    refreshProfile();
  };

  const updateGps = () => {
    if (!user) return;
    if (!navigator.geolocation) return toast.error("GPS não disponível neste navegador");
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { error } = await supabase
          .from("profiles")
          .update({ lat: latitude, lng: longitude, location_updated_at: new Date().toISOString() })
          .eq("id", user.id);
        setGpsBusy(false);
        if (error) return toast.error(error.message);
        refreshProfile();
        toast.success("Localização atualizada");
      },
      (err) => {
        setGpsBusy(false);
        toast.error(err.message || "Não foi possível obter localização");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Até logo!");
    nav({ to: "/login" });
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm("Tem certeza que deseja excluir sua conta? Essa ação não pode ser desfeita.")) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("delete-account");
    setBusy(false);
    if (error) return toast.error(error.message);
    await signOut();
    toast.success("Conta excluída");
    nav({ to: "/login" });
  };

  return (
    <div className="px-5 pt-4 max-w-md mx-auto pb-10">
      <h1 className="font-display text-3xl tracking-wide">Configurações</h1>

      <Section title="Conta">
        <Row icon={<User size={18} />} label="Editar perfil" to="/profile/edit" />
        <button
          onClick={updateGps}
          disabled={gpsBusy}
          className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left"
        >
          {gpsBusy ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          <span className="flex-1 text-sm font-semibold">
            {profile?.lat ? "Atualizar localização (GPS)" : "Ativar localização (GPS)"}
          </span>
          {profile?.location_updated_at && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(profile.location_updated_at).toLocaleDateString("pt-BR")}
            </span>
          )}
        </button>
        {profile?.plan !== "pro" && (
          <Row icon={<Crown size={18} className="text-gold" />} label="TrocaCopa Pro" to="/pro" />
        )}
      </Section>

      <Section title="Privacidade">
        <Toggle
          icon={<Eye size={16} />}
          label="Aparecer no radar de colecionadores"
          checked={discoverable}
          onChange={setDiscoverable}
        />
      </Section>

      <Section title="Notificações">
        <Toggle label="Pedidos de troca" checked={prefs.trades !== false} onChange={(v) => updatePref("trades", v)} />
        <Toggle label="Mensagens" checked={prefs.messages !== false} onChange={(v) => updatePref("messages", v)} />
        <Toggle label="Novos matches" checked={prefs.matches !== false} onChange={(v) => updatePref("matches", v)} />
      </Section>

      <Section title="Conta">
        <button onClick={handleLogout} className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left">
          <LogOut size={18} /> <span className="flex-1 text-sm font-semibold">Sair</span>
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left text-destructive border border-destructive/30"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          <span className="flex-1 text-sm font-semibold">Excluir conta</span>
        </button>
      </Section>

      <Section title="Sobre">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <Info size={18} className="text-muted-foreground" />
          <span className="flex-1 text-sm">Versão</span>
          <span className="text-xs text-muted-foreground">{APP_VERSION}</span>
        </div>
      </Section>

      <p className="text-center text-[10px] text-muted-foreground mt-8">
        TrocaCopa © {new Date().getFullYear()}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </motion.section>
  );
}

function Row({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to as any} className="glass rounded-2xl p-4 flex items-center gap-3">
      {icon} <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </Link>
  );
}

function Toggle({ icon, label, checked, onChange }: { icon?: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      {icon}
      <span className="flex-1 text-sm">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-surface"}`}
      >
        <span className={`block w-6 h-6 rounded-full bg-background transition ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
