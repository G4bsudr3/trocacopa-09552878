import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, MapPin, Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/near")({
  head: () => ({ meta: [{ title: "Perto de mim — TrocaCopa" }] }),
  component: Near,
});

type NearbyRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  plan: string;
  album_progress: number;
  trades_count: number;
  distance_km: number;
  match_count: number;
  reverse_match_count: number;
  proximity_score: number;
  compat_score: number;
};

const RADII = [10, 25, 50, 100] as const;

function Near() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [radius, setRadius] = useState<(typeof RADII)[number]>(50);

  const nearby = useQuery({
    queryKey: ["nearby", user?.id, profile?.lat, profile?.lng, radius],
    enabled: !!user && profile?.lat != null && profile?.lng != null,
    queryFn: async (): Promise<NearbyRow[]> => {
      const { data, error } = await supabase.rpc("nearby_collectors", { _radius_km: radius });
      if (error) throw error;
      return (data ?? []) as NearbyRow[];
    },
  });

  const startTrade = async (otherId: string) => {
    if (!user) return;
    // Check if there's already an open trade
    const { data: existing } = await supabase
      .from("trades")
      .select("id")
      .or(`and(requester_id.eq.${user.id},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .in("status", ["pending", "accepted"])
      .maybeSingle();
    if (existing) {
      nav({ to: "/trade/$id", params: { id: existing.id } });
      return;
    }
    const { data, error } = await supabase
      .from("trades")
      .insert({ requester_id: user.id, receiver_id: otherId, offered_stickers: [], requested_stickers: [] })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message || "Erro ao criar troca");
    nav({ to: "/trade/$id", params: { id: data.id } });
  };

  if (!profile?.lat) {
    return (
      <div className="px-5 pt-4 max-w-md mx-auto">
        <h1 className="font-display text-3xl tracking-wide">Perto de Mim</h1>
        <div className="glass-strong rounded-3xl p-8 mt-6 text-center">
          <Compass className="mx-auto text-primary" size={48} />
          <p className="font-display text-xl mt-3">Ative sua localização</p>
          <p className="text-sm text-muted-foreground mt-2">
            Para encontrar colecionadores próximos, precisamos da sua localização.
          </p>
          <Link
            to="/profile/edit"
            className="mt-5 inline-block gradient-primary text-primary-foreground rounded-full px-6 py-3 font-bold glow-primary"
          >
            Ativar localização
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Perto de Mim</h1>
      <p className="text-sm text-muted-foreground">Colecionadores num raio de 25km</p>

      <div className="mt-4 h-40 rounded-3xl glass-strong relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,oklch(0.78_0.22_152)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,oklch(0.86_0.16_92)_0%,transparent_40%)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/20 animate-ping absolute" />
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary relative">
              <MapPin className="text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-display text-xl tracking-wide mt-6 mb-3">Ordenado por compatibilidade</h2>

      {nearby.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : nearby.data && nearby.data.length > 0 ? (
        <div className="space-y-3">
          {nearby.data.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden gradient-primary flex items-center justify-center font-bold text-primary-foreground shrink-0">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (c.full_name?.[0] || "?").toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{c.full_name || "Colecionador"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.city || "—"} · ~{c.distance_km.toFixed(1)} km
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl text-primary text-glow leading-none">{c.match_count}</p>
                  <p className="text-[10px] text-gold uppercase tracking-wider">match 🔥</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Tem <span className="text-primary font-semibold">{c.match_count}</span> figurinhas que você precisa
              </p>
              <button
                onClick={() => startTrade(c.id)}
                className="mt-3 w-full gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <MessageCircle size={16} /> Iniciar Troca
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10 glass rounded-2xl">
          Ninguém por perto ainda. Convide amigos para usar o TrocaCopa!
        </p>
      )}

      {nearby.isFetching && nearby.data && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
          <Loader2 size={12} className="animate-spin" /> Atualizando...
        </div>
      )}
    </div>
  );
}
