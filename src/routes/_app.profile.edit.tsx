import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, MapPin, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/profile/edit")({
  head: () => ({ meta: [{ title: "Editar Perfil — TrocaCopa" }] }),
  component: EditProfile,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(80),
  city: z.string().trim().min(2, "Cidade obrigatória").max(80),
  bio: z.string().trim().max(280, "Máximo 280 caracteres").optional(),
});

function EditProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setCity(profile.city ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Imagem máx. 4MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success("Avatar enviado");
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      toast.error("GPS não disponível neste navegador");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!user) return;
        const { error } = await supabase
          .from("profiles")
          .update({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        setLocating(false);
        if (error) return toast.error(error.message);
        toast.success("Localização atualizada");
        refreshProfile();
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || "Não foi possível obter localização");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ full_name: fullName, city, bio: bio || undefined });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        city: parsed.data.city,
        bio: parsed.data.bio ?? null,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    await refreshProfile();
    nav({ to: "/profile" });
  };

  return (
    <div className="px-5 pt-4 max-w-md mx-auto pb-10">
      <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="font-display text-3xl tracking-wide mt-2">Editar Perfil</h1>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-col items-center">
        <label className="relative cursor-pointer group">
          <div className="w-28 h-28 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-display text-4xl text-primary-foreground glow-primary">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              fullName?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
          </div>
          <input type="file" accept="image/*" onChange={onAvatar} className="hidden" />
        </label>
        <p className="text-xs text-muted-foreground mt-2">Toque para trocar a foto</p>
      </motion.div>

      <div className="space-y-4 mt-6">
        <Field label="Nome completo" error={errors.full_name}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-input rounded-2xl px-4 py-3 outline-none border border-transparent focus:border-primary"
            placeholder="Seu nome"
          />
        </Field>
        <Field label="Cidade" error={errors.city}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-input rounded-2xl px-4 py-3 outline-none border border-transparent focus:border-primary"
            placeholder="Sua cidade"
          />
        </Field>
        <Field label="Bio" error={errors.bio}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={280}
            className="w-full bg-input rounded-2xl px-4 py-3 outline-none border border-transparent focus:border-primary resize-none"
            placeholder="Conte um pouco sobre suas trocas..."
          />
        </Field>

        <button
          onClick={useGps}
          disabled={locating}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center justify-between border border-border"
        >
          <span className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-primary" />
            {profile?.lat ? "Atualizar minha localização" : "Ativar localização (GPS)"}
          </span>
          {locating ? (
            <Loader2 size={16} className="animate-spin text-primary" />
          ) : (
            <span className="text-xs text-muted-foreground">
              {profile?.lat ? "✓ ativada" : "obrigatório p/ trocas"}
            </span>
          )}
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 w-full gradient-primary text-primary-foreground rounded-full py-3.5 font-bold glow-primary disabled:opacity-60 active:scale-95 transition flex items-center justify-center gap-2"
      >
        {saving && <Loader2 size={16} className="animate-spin" />} Salvar
      </button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
