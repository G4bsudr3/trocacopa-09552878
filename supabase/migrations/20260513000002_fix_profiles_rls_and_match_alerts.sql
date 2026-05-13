-- =============================================================
-- CORREÇÕES v3 — 2026-05-13
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: profiles SELECT policy — own OR discoverable OR trade partner
--
-- A migração anterior (profiles_select_own) restringia ao próprio
-- perfil apenas, quebrando:
--   • _app.trades.tsx: requester/receiver profile FK join → null names
--   • _app.profile.tsx: reviewer profile FK join → null names/avatars
--   • public_profiles view (security_invoker=true) → vazia para outros
--
-- Solução correta em duas camadas:
--   1. Row-level: own OR discoverable OR trade partner
--      (parceiros de troca ficam visíveis mesmo com discoverable=false,
--       necessário para que menores vejam nome/avatar do parceiro)
--   2. Column-level: sensíveis já revogados pela migration anterior
--      (lat, lng, guardian_email, birth_date, notification_prefs etc.)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR COALESCE(discoverable, true) = true
    OR EXISTS (
      SELECT 1 FROM public.trades t
      WHERE (t.requester_id = auth.uid() OR t.receiver_id = auth.uid())
        AND (t.requester_id = id          OR t.receiver_id = id)
    )
  );

-- ---------------------------------------------------------------
-- FIX 2: get_my_profile() — tipo de retorno consistente
--
-- Lovable tentou CREATE OR REPLACE com return type diferente (single
-- row em vez de SETOF), o que pode causar inconsistência. Garantir
-- SETOF para que auth.tsx/.maybeSingle() funcione corretamente.
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_profile();

CREATE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ---------------------------------------------------------------
-- FIX 3: scan_match_alerts() — restaurar implementação real
--
-- Migration do Lovable substituiu a implementação por stub WHERE false,
-- desabilitando todas as notificações de match alto. Restaurar a versão
-- funcional com filtragem age-peer (minores só alertam para menores,
-- adultos só para adultos), conforme regra de negócio ECA Digital.
-- Função é SECURITY DEFINER: acessa lat/lng/notification_prefs via
-- privilégio elevado, bypassando column-level REVOKE.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_match_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  inserted_count int := 0;
  u record;
  m record;
  radius double precision := 50;
BEGIN
  FOR u IN
    SELECT id, lat, lng, age_group,
           NULLIF(lower(unaccent(coalesce(city,''))), '') AS city_norm
    FROM public.profiles
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND COALESCE(notification_prefs->>'matches', 'true') <> 'false'
      AND COALESCE(discoverable, true) = true
  LOOP
    FOR m IN
      WITH others AS (
        SELECT p.id,
          (6371*acos(LEAST(1.0, GREATEST(-1.0,
            cos(radians(u.lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(u.lng))
            + sin(radians(u.lat))*sin(radians(p.lat))
          )))) AS dist,
          NULLIF(lower(unaccent(coalesce(p.city,''))), '') AS city_norm
        FROM public.profiles p
        WHERE p.id <> u.id
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND COALESCE(p.discoverable, true) = true
          -- Age-peer filtering (ECA Digital / Lei Felca)
          AND (
            (u.age_group = 'adult'            AND (p.age_group = 'adult' OR p.age_group IS NULL))
            OR (u.age_group IN ('child','teen') AND p.age_group IN ('child','teen'))
            OR (u.age_group IS NULL            AND (p.age_group = 'adult' OR p.age_group IS NULL))
          )
      ),
      my_owned AS (
        SELECT sticker_code, duplicates FROM public.user_stickers WHERE user_id = u.id
      ),
      my_dupes AS (SELECT sticker_code FROM my_owned WHERE duplicates >= 2),
      my_needs AS (
        SELECT s.code FROM public.stickers s
        LEFT JOIN my_owned mo ON mo.sticker_code = s.code
        WHERE mo.sticker_code IS NULL OR mo.duplicates < 1
      ),
      forward AS (
        SELECT us.user_id, count(*)::int AS give_count
        FROM public.user_stickers us
        JOIN my_needs n ON n.code = us.sticker_code
        WHERE us.duplicates >= 2 GROUP BY us.user_id
      ),
      reverse AS (
        SELECT us_o.user_id, count(*)::int AS receive_count
        FROM (SELECT DISTINCT user_id FROM public.user_stickers) us_o
        JOIN my_dupes md ON true
        LEFT JOIN public.user_stickers theirs
          ON theirs.user_id = us_o.user_id AND theirs.sticker_code = md.sticker_code
        WHERE theirs.user_id IS NULL OR theirs.duplicates < 1
        GROUP BY us_o.user_id
      )
      SELECT
        o.id AS other_id, o.city_norm,
        GREATEST(0, LEAST(100, round((
            0.45 * tanh(LEAST(COALESCE(f.give_count,0), COALESCE(r.receive_count,0))::double precision / 10.0)
          + 0.20 * tanh(COALESCE(f.give_count,0)::double precision  / 15.0)
          + 0.10 * tanh(COALESCE(r.receive_count,0)::double precision / 15.0)
          + 0.15 * GREATEST(0, 1 - o.dist / radius)
          + 0.10 * (CASE WHEN u.city_norm IS NOT NULL AND o.city_norm IS NOT NULL
                          AND u.city_norm = o.city_norm THEN 1.0
                         WHEN o.dist <= 25 THEN 0.5 ELSE 0.0 END)
        ) * 100)::int)) AS score_pct
      FROM others o
      LEFT JOIN forward  f ON f.user_id = o.id
      LEFT JOIN reverse  r ON r.user_id = o.id
      WHERE o.dist <= radius
    LOOP
      IF m.score_pct >= 70 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.match_alerts_sent a
          WHERE a.user_id = u.id AND a.other_id = m.other_id
            AND (a.sent_at > now() - interval '7 days' OR a.score_pct >= m.score_pct - 4)
        ) THEN
          INSERT INTO public.notifications (user_id, type, payload)
          VALUES (u.id, 'match_high', jsonb_build_object(
            'other_id', m.other_id, 'score', m.score_pct, 'city', m.city_norm
          ));
          INSERT INTO public.match_alerts_sent (user_id, other_id, score_pct, sent_at)
          VALUES (u.id, m.other_id, m.score_pct, now())
          ON CONFLICT (user_id, other_id)
          DO UPDATE SET score_pct = EXCLUDED.score_pct, sent_at = now();
          inserted_count := inserted_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scan_match_alerts() FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION public.scan_match_alerts() TO service_role;
