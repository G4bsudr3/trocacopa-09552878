import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, MapPin, Compass, Loader2, Globe2, List, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const NearMap = lazy(() => import("@/components/NearMap"));

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
  distance_km: number | null;
  give_count: number;
  receive_count: number;
  mutual_count: number;
  same_city: boolean;
  region_bonus: number;
  proximity_score: number;
  score_pct: number;
  out_of_radius: boolean;
  compat_album: boolean;
  recent_active: boolean;
  nationwide: boolean;
  lat_approx?: number | null;
  lng_approx?: number | null;
};

const RADII = [10, 25, 50, 100, 500] as const;
type SortMode = "match" | "distance";
type ViewMode = "list" | "map";

function Near() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [radius, setRadius] = useState<(typeof RADII)[number]>(50);
  const [onlyCity, setOnlyCity] = useState(false);
  const [onlyMutual, setOnlyMutual] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [view, setView] = useState<ViewMode>("list");

  const hasGeo = profile?.lat != null && profile?.lng != null;
  const hasCity = !!profile?.city;
  const isMinor = profile?.kids_mode === true || profile?.age_group === "child" || profile?.age_group === "teen";
  const canShowMap = hasGeo && !isMinor;

  const nearby = useQuery({
    queryKey: ["match", user?.id, radius, view, isMinor],
    enabled: !!user,
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<NearbyRow[]> => {
      const rpc = view === "map" && !isMinor ? "match_collectors_geo" : "match_collectors";
      const { data, error } = await supabase.rpc(rpc as any, { _radius_km: radius });
      if (error) throw error;
      return (data ?? []) as unknown as NearbyRow[];
    },
  });

  const filtered = useMemo(() => {
    let rows = nearby.data ?? [];
    if (onlyCity) rows = rows.filter((r) => r.same_city);
    if (onlyMutual) rows = rows.filter((r) => r.mutual_count >= 1);
    if (sortMode === "distance") {
      rows = [...rows].sort(
        (a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9),
      );
    }
    return rows;
  }, [nearby.data, onlyCity, onlyMutual, sortMode]);

  const startTrade = async (otherId: string) => {
    if (!user) return;
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

  return (
    <div className="px-5 pt-4 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Perto de Mim</h1>
      <p className="text-sm text-muted-foreground">Score = trocas viáveis + cidade + álbum</p>

      {!hasGeo && (
        <Link
          to="/profile/edit"
          className="mt-3 flex items-center gap-2 glass rounded-2xl px-4 py-3 text-xs text-muted-foreground"
        >
          <Compass size={14} className="text-primary" />
          {hasCity
            ? "Ative sua localização para ver distâncias precisas"
            : "Sem cidade nem localização — mostrando matches do Brasil inteiro"}
        </Link>
      )}

      <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
        {RADII.map((r) => (
          <button
            key={r}
            onClick={() => setRadius(r)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
              radius === r
                ? "gradient-primary text-primary-foreground glow-primary"
                : "glass text-muted-foreground"
            }`}
          >
            {r >= 500 ? "🌎 Brasil" : `${r} km`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => setOnlyCity((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
            onlyCity ? "bg-primary/20 text-primary border border-primary/40" : "glass text-muted-foreground"
          }`}
        >
          📍 Só mesma cidade
        </button>
        <button
          onClick={() => setOnlyMutual((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
            onlyMutual ? "bg-primary/20 text-primary border border-primary/40" : "glass text-muted-foreground"
          }`}
        >
          🔁 Só com troca 1-1
        </button>
        <div className="ml-auto flex gap-1 glass rounded-full p-1">
          <button
            onClick={() => setSortMode("match")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold ${sortMode === "match" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Melhor match
          </button>
          <button
            onClick={() => setSortMode("distance")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold ${sortMode === "distance" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            disabled={!hasGeo}
            title={!hasGeo ? "Ative localização" : undefined}
          >
            Mais perto
          </button>
        </div>
      </div>

      {canShowMap && (
        <div className="mt-4 flex gap-1 glass rounded-full p-1 w-fit">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <List size={12} /> Lista
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <MapIcon size={12} /> Mapa
          </button>
        </div>
      )}

      {view === "map" && canShowMap ? (
        <div className="mt-4">
          <Suspense fallback={<div className="w-full h-[60vh] md:h-[70vh] rounded-2xl bg-surface animate-pulse" />}>
            <NearMap
              rows={(filtered as any[]).filter((r) => r.lat_approx != null && r.lng_approx != null) as any}
              myLat={profile!.lat as number}
              myLng={profile!.lng as number}
              radiusKm={radius}
              onStartTrade={startTrade}
            />
          </Suspense>
          {filtered.filter((r: any) => r.lat_approx != null).length === 0 && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              Ninguém com localização visível neste raio. Tente aumentar ou abrir a lista.
            </p>
          )}
        </div>
      ) : (
        <>
      <h2 className="font-display text-xl tracking-wide mt-6 mb-3">Melhores matches</h2>

      {nearby.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((c) => {
            const score = c.score_pct ?? 0;
            const isClose = c.distance_km != null && c.distance_km < radius * 0.25;
            return (
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold truncate">{c.full_name || "Colecionador"}</p>
                      {c.same_city && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                          📍 Mesma cidade
                        </span>
                      )}
                      {!c.same_city && isClose && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold/20 text-gold">
                          🎯 Perto
                        </span>
                      )}
                      {c.out_of_radius && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent flex items-center gap-1">
                          <Globe2 size={10} /> Fora do raio
                        </span>
                      )}
                      {c.compat_album && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface text-muted-foreground">
                          📊 Álbum parecido
                        </span>
                      )}
                      {!c.recent_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted-foreground">
                          💤 Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.city || "—"}
                      {c.distance_km != null ? ` · ~${c.distance_km.toFixed(1)} km` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl text-primary text-glow leading-none">{score}</p>
                    <p className="text-[10px] text-gold uppercase tracking-wider">match</p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full gradient-primary" style={{ width: `${score}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-surface rounded-lg px-2 py-2">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Trocas 1-1</p>
                    <p className="font-display text-lg text-gold leading-none mt-0.5">{c.mutual_count}</p>
                  </div>
                  <div className="bg-surface rounded-lg px-2 py-2">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Tem pra você</p>
                    <p className="font-display text-lg text-primary leading-none mt-0.5">{c.give_count}</p>
                  </div>
                  <div className="bg-surface rounded-lg px-2 py-2">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Você oferece</p>
                    <p className="font-display text-lg text-primary leading-none mt-0.5">{c.receive_count}</p>
                  </div>
                </div>

                <button
                  onClick={() => startTrade(c.id)}
                  className="mt-3 w-full gradient-primary text-primary-foreground rounded-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <MessageCircle size={16} /> Iniciar Troca
                </button>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-10 glass rounded-2xl space-y-2">
          <p>Nenhum match encontrado.</p>
          <p className="text-xs">
            {hasGeo
              ? "Tente aumentar o raio acima ou cadastrar mais figurinhas."
              : hasCity
                ? "Ative sua localização ou aumente para Brasil."
                : "Cadastre sua cidade e adicione mais figurinhas no álbum."}
          </p>
          {!hasGeo && (
            <Link to="/profile/edit" className="inline-flex items-center gap-1 text-primary font-semibold text-xs">
              <MapPin size={12} /> Atualizar perfil
            </Link>
          )}
        </div>
      )}
        </>
      )}

      {nearby.isError && (
        <div className="text-sm text-destructive text-center py-6 glass rounded-2xl mt-4">
          Não foi possível carregar os matches. Verifique sua conexão e tente novamente.
        </div>
      )}

      {nearby.isFetching && nearby.data && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
          <Loader2 size={12} className="animate-spin" /> Atualizando...
        </div>
      )}
    </div>
  );
}
