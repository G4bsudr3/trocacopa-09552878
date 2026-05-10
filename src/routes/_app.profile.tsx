import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { TOTAL_STICKERS } from "@/lib/stickers";
import { Edit3, LogOut, Crown, Star, Settings as SettingsIcon, Repeat2, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAlbum } from "@/lib/use-album";
const InviteFriendSheet = lazy(() => import("@/components/invite-friend-sheet").then((m) => ({ default: m.InviteFriendSheet })));

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — TrocaCopa" }] }),
  component: Profile,
});

function Profile() {
  const { profile, user, signOut } = useAuth();
  const nav = useNavigate();
  const { stickers } = useAlbum();
  const [inviteOpen, setInviteOpen] = useState(false);
  const dupUnique = stickers.filter((s) => s.duplicates > 1).length;
  const dupExtras = stickers.reduce((a, s) => a + Math.max(0, s.duplicates - 1), 0);

  const friendsCount = useQuery({
    queryKey: ["friends-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      return count ?? 0;
    },
  });

  const stats = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: tradesCount }, { data: reviews }] = await Promise.all([
        supabase
          .from("trades")
          .select("id", { count: "exact", head: true })
          .or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
          .eq("status", "completed"),
        supabase
          .from("reviews")
          .select("stars,comment,reviewer_id,created_at")
          .eq("reviewed_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return { tradesCount: tradesCount ?? 0, reviews: reviews ?? [] };
    },
  });

  const trades = stats.data?.tradesCount ?? profile?.trades_count ?? 0;
  const owned = profile?.album_progress ?? 0;
  const pct = Math.round((owned / TOTAL_STICKERS) * 100);

  const badge =
    trades < 10
      ? { icon: "🥉", name: "Iniciante" }
      : trades < 30
        ? { icon: "🥈", name: "Colecionador" }
        : { icon: "🥇", name: "Mestre das Trocas" };

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Perfil</h1>
        <Link to="/settings" className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <SettingsIcon size={18} />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-3xl p-6 mt-4 text-center relative overflow-hidden"
      >
        <div className="absolute -top-10 inset-x-0 h-32 gradient-hero opacity-20 blur-3xl" />
        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden gradient-primary flex items-center justify-center font-display text-4xl text-primary-foreground glow-primary relative">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <h2 className="font-display text-2xl mt-3">{profile?.full_name || "Colecionador"}</h2>
        <p className="text-sm text-muted-foreground">{profile?.city || "Defina sua cidade"}</p>
        {profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>}
        {profile?.plan === "pro" && (
          <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full gradient-gold text-gold-foreground text-xs font-bold glow-gold">
            <Crown size={12} /> PRO
          </span>
        )}

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Stat n={trades} label="Trocas" />
          <Stat n={owned} label="Figurinhas" />
          <Stat n={`${pct}%`} label="Álbum" />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-gold/30">
          <span className="text-2xl">{badge.icon}</span>
          <span className="font-semibold text-sm">{badge.name}</span>
        </div>
      </motion.div>

      <Link to="/duplicates" className="block mt-4">
        <div className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-gold/30 active:scale-[0.99] transition">
          <span className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center glow-gold shrink-0">
            <Repeat2 className="text-gold-foreground" size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg leading-tight">Minhas Repetidas</p>
            <p className="text-xs text-muted-foreground">
              {dupUnique > 0
                ? `${dupUnique} figurinhas · ${dupExtras} trocáveis`
                : "Nenhuma repetida ainda — marque no álbum"}
            </p>
          </div>
          <span className="text-gold font-display text-2xl">→</span>
        </div>
      </Link>

      <button onClick={() => setInviteOpen(true)} className="block w-full mt-3 text-left">
        <div className="glass-strong rounded-2xl p-4 flex items-center gap-3 border border-primary/30 active:scale-[0.99] transition">
          <span className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center glow-primary shrink-0">
            <UserPlus className="text-primary-foreground" size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg leading-tight">Convidar amigo (QR)</p>
            <p className="text-xs text-muted-foreground">
              {friendsCount.data ? `${friendsCount.data} amigo${friendsCount.data === 1 ? "" : "s"} no app · vire match automático` : "Quem entrar pelo seu QR já vira amigo"}
            </p>
          </div>
          <span className="text-primary font-display text-2xl">→</span>
        </div>
      </button>

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
        {stats.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : stats.data && stats.data.reviews.length > 0 ? (
          <div className="space-y-2">
            {stats.data.reviews.map((r) => (
              <div key={`${r.reviewer_id}-${r.created_at}`} className="glass rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.stars }).map((_, s) => (
                      <Star key={s} size={12} className="fill-gold text-gold" />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6 glass rounded-2xl">
            Nenhuma avaliação ainda. Faça sua primeira troca!
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2 mt-6 mb-4">
        <Link to="/profile/edit" className="glass rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
          <Edit3 size={14} /> Editar Perfil
        </Link>
        <button
          onClick={async () => {
            await signOut();
            toast.success("Até logo!");
            nav({ to: "/login" });
          }}
          className="glass rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 text-destructive"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>

      <InviteFriendSheet open={inviteOpen} onOpenChange={setInviteOpen} />
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
