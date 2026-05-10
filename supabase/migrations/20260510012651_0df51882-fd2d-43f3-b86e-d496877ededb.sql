
-- ============================================
-- ECA Digital (Lei Felca) - schema changes
-- ============================================

-- 1. Enum for age group
DO $$ BEGIN
  CREATE TYPE public.age_group AS ENUM ('child', 'teen', 'adult');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enum for report reason / status / target
DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM ('improper_language','strange_behavior','asked_personal_info','adult_content','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open','reviewed','actioned','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target AS ENUM ('user','trade','message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS age_group public.age_group,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS kids_mode boolean NOT NULL DEFAULT false;

-- 4. Trigger to compute age_group + force kids_mode privacy defaults
CREATE OR REPLACE FUNCTION public.enforce_age_and_kids_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  age_years int;
BEGIN
  IF NEW.birth_date IS NOT NULL THEN
    age_years := date_part('year', age(NEW.birth_date))::int;
    IF age_years < 13 THEN
      NEW.age_group := 'child';
    ELSIF age_years < 18 THEN
      NEW.age_group := 'teen';
    ELSE
      NEW.age_group := 'adult';
    END IF;
  END IF;

  -- Kids mode is forced ON for any minor
  IF NEW.age_group IN ('child','teen') THEN
    NEW.kids_mode := true;
    NEW.discoverable := false;
    NEW.lat := NULL;
    NEW.lng := NULL;
    NEW.bio := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_age_kids ON public.profiles;
CREATE TRIGGER trg_enforce_age_kids
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_age_and_kids_mode();

-- 5. Update handle_new_user to capture birth_date and guardian_email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  bd date;
BEGIN
  BEGIN
    bd := NULLIF(meta->>'birth_date','')::date;
  EXCEPTION WHEN others THEN bd := NULL; END;

  INSERT INTO public.profiles (id, full_name, city, avatar_url, birth_date, guardian_email, guardian_name)
  VALUES (
    new.id,
    COALESCE(meta->>'full_name', meta->>'name', split_part(new.email, '@', 1)),
    NULLIF(meta->>'city',''),
    NULLIF(meta->>'avatar_url',''),
    bd,
    NULLIF(meta->>'guardian_email',''),
    NULLIF(meta->>'guardian_name','')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 6. Guardian consent table
CREATE TABLE IF NOT EXISTS public.guardian_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minor_user_id uuid NOT NULL,
  guardian_email text NOT NULL,
  guardian_name text,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.guardian_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minor sees own consent" ON public.guardian_consents;
CREATE POLICY "minor sees own consent"
  ON public.guardian_consents FOR SELECT
  TO authenticated
  USING (auth.uid() = minor_user_id);

DROP POLICY IF EXISTS "minor inserts own consent" ON public.guardian_consents;
CREATE POLICY "minor inserts own consent"
  ON public.guardian_consents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = minor_user_id);

-- Public read by token is handled by SECURITY DEFINER functions only.

-- 7. Content reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type public.report_target NOT NULL,
  target_id text NOT NULL,
  reason public.report_reason NOT NULL,
  details text,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_id uuid
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporter inserts" ON public.content_reports;
CREATE POLICY "reporter inserts"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reporter sees own" ON public.content_reports;
CREATE POLICY "reporter sees own"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "admin updates" ON public.content_reports;
CREATE POLICY "admin updates"
  ON public.content_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.content_reports(status, created_at DESC);

-- 8. SECURITY DEFINER helpers for guardian consent flow (public token lookup)
CREATE OR REPLACE FUNCTION public.guardian_consent_lookup(_token uuid)
RETURNS TABLE(minor_user_id uuid, minor_name text, minor_birth_date date,
              guardian_email text, requested_at timestamptz,
              approved_at timestamptz, revoked_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.minor_user_id, p.full_name, p.birth_date,
         gc.guardian_email, gc.requested_at,
         gc.approved_at, gc.revoked_at, gc.expires_at
  FROM public.guardian_consents gc
  LEFT JOIN public.profiles p ON p.id = gc.minor_user_id
  WHERE gc.token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.guardian_consent_approve(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  SELECT * INTO rec FROM public.guardian_consents WHERE token = _token FOR UPDATE;
  IF rec IS NULL THEN RETURN false; END IF;
  IF rec.revoked_at IS NOT NULL OR rec.expires_at < now() THEN RETURN false; END IF;
  IF rec.approved_at IS NOT NULL THEN RETURN true; END IF;

  UPDATE public.guardian_consents SET approved_at = now() WHERE id = rec.id;
  UPDATE public.profiles SET guardian_consent_at = now(), updated_at = now()
   WHERE id = rec.minor_user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_consent_revoke(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  SELECT * INTO rec FROM public.guardian_consents WHERE token = _token FOR UPDATE;
  IF rec IS NULL THEN RETURN false; END IF;
  UPDATE public.guardian_consents SET revoked_at = now() WHERE id = rec.id;
  UPDATE public.profiles SET guardian_consent_at = NULL, updated_at = now()
   WHERE id = rec.minor_user_id;
  RETURN true;
END;
$$;

-- Allow anonymous (public link) to call these
GRANT EXECUTE ON FUNCTION public.guardian_consent_lookup(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_consent_approve(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_consent_revoke(uuid) TO anon, authenticated;

-- 9. Update match_collectors / nearby_collectors to filter by age peer-group
CREATE OR REPLACE FUNCTION public.nearby_collectors(_radius_km double precision DEFAULT 50)
 RETURNS TABLE(id uuid, full_name text, city text, avatar_url text, plan text, album_progress integer, trades_count integer, distance_km double precision, match_count integer, reverse_match_count integer, proximity_score double precision, compat_score double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_lat double precision; my_lng double precision;
  my_age public.age_group;
  radius double precision := GREATEST(5, LEAST(COALESCE(_radius_km, 50), 200));
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.lat, p.lng, p.age_group INTO my_lat, my_lng, my_age FROM public.profiles p WHERE p.id = me;
  IF my_lat IS NULL OR my_lng IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH others AS (
    SELECT p.*, (6371*acos(cos(radians(my_lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(my_lng))+sin(radians(my_lat))*sin(radians(p.lat)))) AS dist
    FROM public.profiles p
    WHERE p.id <> me AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.discoverable = true
      AND (
        -- Peer-only matching: minors only see minors, adults only see adults; unknown sees adults only
        (my_age = 'adult' AND (p.age_group = 'adult' OR p.age_group IS NULL))
        OR (my_age IN ('child','teen') AND p.age_group IN ('child','teen'))
        OR (my_age IS NULL AND (p.age_group = 'adult' OR p.age_group IS NULL))
      )
  ),
  my_owned AS (
    SELECT us.sticker_code, us.duplicates FROM public.user_stickers us WHERE us.user_id = me
  ),
  my_needs AS (
    SELECT s.code FROM public.stickers s
    LEFT JOIN public.user_stickers us ON us.sticker_code = s.code AND us.user_id = me
    WHERE us.user_id IS NULL
  ),
  forward AS (
    SELECT us.user_id, count(*)::int AS match_count
    FROM public.user_stickers us
    JOIN my_needs n ON n.code = us.sticker_code
    WHERE us.duplicates >= 1 GROUP BY us.user_id
  ),
  reverse AS (
    SELECT us.user_id, count(*)::int AS reverse_match_count
    FROM public.user_stickers us
    JOIN my_owned mo ON mo.sticker_code = us.sticker_code AND mo.duplicates >= 2
    LEFT JOIN public.user_stickers theirs ON theirs.user_id = us.user_id AND theirs.sticker_code = mo.sticker_code
    WHERE theirs.user_id IS NULL OR theirs.duplicates < 1
    GROUP BY us.user_id
  )
  SELECT
    o.id, o.full_name, o.city, o.avatar_url, o.plan, o.album_progress, o.trades_count,
    o.dist AS distance_km,
    COALESCE(f.match_count, 0) AS match_count,
    COALESCE(r.reverse_match_count, 0) AS reverse_match_count,
    GREATEST(0, 1 - o.dist / radius) AS proximity_score,
    (
      0.55 * LEAST(COALESCE(f.match_count,0), 30)::double precision / 30.0
      + 0.25 * LEAST(COALESCE(r.reverse_match_count,0), 30)::double precision / 30.0
      + 0.20 * GREATEST(0, 1 - o.dist / radius)
    ) AS compat_score
  FROM others o
  LEFT JOIN forward f ON f.user_id = o.id
  LEFT JOIN reverse r ON r.user_id = o.id
  WHERE o.dist <= radius
  ORDER BY
    (COALESCE(f.match_count, 0) + COALESCE(r.reverse_match_count, 0)) DESC,
    o.dist ASC
  LIMIT 100;
END; $function$;

CREATE OR REPLACE FUNCTION public.match_collectors(_radius_km double precision DEFAULT 50)
 RETURNS TABLE(id uuid, full_name text, city text, avatar_url text, plan text, album_progress integer, trades_count integer, distance_km double precision, give_count integer, receive_count integer, mutual_count integer, same_city boolean, region_bonus double precision, proximity_score double precision, score_pct integer, out_of_radius boolean, compat_album boolean, recent_active boolean, nationwide boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_lat double precision; my_lng double precision;
  my_city_norm text; my_progress int;
  my_age public.age_group;
  has_geo boolean; has_city boolean;
  radius double precision := GREATEST(5, LEAST(COALESCE(_radius_km, 50), 500));
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.lat, p.lng, NULLIF(lower(unaccent(coalesce(p.city, ''))), ''),
         COALESCE(p.album_progress, 0), p.age_group
    INTO my_lat, my_lng, my_city_norm, my_progress, my_age
    FROM public.profiles p WHERE p.id = me;

  has_geo := my_lat IS NOT NULL AND my_lng IS NOT NULL;
  has_city := my_city_norm IS NOT NULL;

  RETURN QUERY
  WITH others AS (
    SELECT
      p.*,
      CASE WHEN has_geo AND p.lat IS NOT NULL AND p.lng IS NOT NULL THEN
        (6371*acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(my_lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(my_lng))
          + sin(radians(my_lat))*sin(radians(p.lat))
        ))))
      ELSE NULL END AS dist,
      NULLIF(lower(unaccent(coalesce(p.city, ''))), '') AS city_norm,
      (p.updated_at > now() - interval '60 days') AS is_active
    FROM public.profiles p
    WHERE p.id <> me AND p.discoverable = true
      AND (
        (my_age = 'adult' AND (p.age_group = 'adult' OR p.age_group IS NULL))
        OR (my_age IN ('child','teen') AND p.age_group IN ('child','teen'))
        OR (my_age IS NULL AND (p.age_group = 'adult' OR p.age_group IS NULL))
      )
  ),
  my_owned AS (SELECT us.sticker_code, us.duplicates FROM public.user_stickers us WHERE us.user_id = me),
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
    LEFT JOIN public.user_stickers theirs
      ON theirs.user_id = us_o.user_id
     AND theirs.sticker_code IN (SELECT sticker_code FROM my_dupes)
     AND theirs.duplicates >= 1
    CROSS JOIN LATERAL (SELECT count(*)::int AS total FROM my_dupes) d
    GROUP BY us_o.user_id, d.total
    HAVING d.total - count(theirs.sticker_code) > 0
  ),
  scored AS (
    SELECT
      o.id, o.full_name, o.city, o.avatar_url, o.plan,
      o.album_progress, o.trades_count, o.dist,
      COALESCE(f.give_count, 0) AS give_count,
      COALESCE(r.receive_count, 0) AS receive_count,
      LEAST(COALESCE(f.give_count, 0), COALESCE(r.receive_count, 0)) AS mutual_count,
      (has_city AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm) AS same_city,
      o.is_active,
      (abs(COALESCE(o.album_progress,0) - my_progress) <= GREATEST(20, my_progress * 0.2)) AS compat_album,
      CASE WHEN has_city AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm THEN 1.0
           WHEN has_geo AND o.dist IS NOT NULL AND o.dist <= 25 THEN 0.5 ELSE 0.0 END AS region_bonus,
      CASE WHEN has_geo AND o.dist IS NOT NULL THEN GREATEST(0, 1 - o.dist / radius) ELSE 0.0 END AS proximity_score
    FROM others o
    LEFT JOIN forward f ON f.user_id = o.id
    LEFT JOIN reverse r ON r.user_id = o.id
  ),
  ranked AS (
    SELECT s.*,
      (has_geo AND s.dist IS NOT NULL AND s.dist > radius AND s.mutual_count >= 3) AS out_of_radius,
      (NOT has_geo AND NOT has_city) AS nationwide,
      GREATEST(0, LEAST(100, round(
        ( 0.50 * tanh(s.mutual_count::double precision / 8.0)
        + 0.18 * tanh(s.give_count::double precision / 12.0)
        + 0.10 * tanh(s.receive_count::double precision / 12.0)
        + 0.12 * s.proximity_score
        + 0.10 * s.region_bonus )
        * (CASE WHEN s.is_active THEN 1.0 ELSE 0.85 END)
        * (CASE WHEN s.compat_album THEN 1.05 ELSE 1.0 END) * 100
      )::int)) AS score_pct
    FROM scored s
  )
  SELECT r.id, r.full_name, r.city, r.avatar_url, r.plan,
    r.album_progress, r.trades_count, r.dist AS distance_km,
    r.give_count, r.receive_count, r.mutual_count,
    r.same_city, r.region_bonus, r.proximity_score, r.score_pct,
    r.out_of_radius, r.compat_album, r.is_active AS recent_active, r.nationwide
  FROM ranked r
  WHERE (r.give_count > 0 OR r.receive_count > 0 OR r.same_city)
    AND ( (has_geo AND (r.dist IS NULL OR r.dist <= radius OR r.same_city OR r.mutual_count >= 3))
          OR (NOT has_geo AND has_city AND (r.same_city OR r.mutual_count >= 2 OR r.give_count >= 5))
          OR (NOT has_geo AND NOT has_city) )
  ORDER BY r.score_pct DESC, r.mutual_count DESC, r.same_city DESC,
    COALESCE(r.dist, 1e9) ASC, r.album_progress DESC, r.id ASC
  LIMIT 100;
END; $function$;

-- 10. Backfill existing users: set age_group=adult IF birth_date null kept null, kids_mode=false
-- We do not assume age. Will be enforced when they fill DOB.
UPDATE public.profiles SET kids_mode = false WHERE kids_mode IS NULL;
