import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  bio: string | null;
  plan: string;
  album_progress: number;
  trades_count: number;
  lat: number | null;
  lng: number | null;
  location_updated_at: string | null;
  notification_prefs: { trades?: boolean; messages?: boolean; matches?: boolean } | null;
  discoverable?: boolean;
  birth_date?: string | null;
  age_group?: "child" | "teen" | "adult" | null;
  guardian_email?: string | null;
  guardian_name?: string | null;
  guardian_consent_at?: string | null;
  kids_mode?: boolean | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error) {
      console.error("[Auth] fetchProfile:", error.message);
      return;
    }
    setProfile(data as Profile | null);
  };

  const consumePendingInvite = async () => {
    if (typeof window === "undefined") return;
    const code = localStorage.getItem("pendingInvite");
    if (!code) return;
    try {
      const { data, error } = await supabase.rpc("accept_invite", { _code: code });
      if (!error) {
        localStorage.removeItem("pendingInvite");
        const res = data as { ok?: boolean; error?: string } | null;
        if (res?.ok) {
          const { toast } = await import("sonner");
          toast.success("Você ganhou um novo amigo no TrocaCopa! 🎉");
        }
      }
    } catch {
      // network error — keep code in localStorage for retry on next session
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchProfile(s.user.id), 0);
        setTimeout(() => consumePendingInvite(), 100);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await fetchProfile(data.session.user.id);
      setLoading(false);
    });

    // Native Android: handle OAuth deep link callback (trocacopa://auth/callback)
    let appListenerCleanup: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("trocacopa://auth/callback")) return;
          // PKCE flow: ?code=...
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) console.error("[Auth] exchangeCodeForSession:", error.message);
            return;
          }
          // Implicit flow: #access_token=...
          const hash = url.split("#")[1];
          if (hash) {
            const params = new URLSearchParams(hash);
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }).then((handle) => {
          appListenerCleanup = () => handle.remove();
        });
      });
    }

    return () => {
      sub.subscription.unsubscribe();
      appListenerCleanup?.();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshProfile: async () => {
          if (session?.user) await fetchProfile(session.user.id);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
