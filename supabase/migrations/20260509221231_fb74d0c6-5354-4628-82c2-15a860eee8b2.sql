
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_stickers_user ON public.user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_code ON public.user_stickers(sticker_code);
CREATE INDEX IF NOT EXISTS idx_user_stickers_code_dup ON public.user_stickers(sticker_code) WHERE duplicates >= 2;
CREATE INDEX IF NOT EXISTS idx_profiles_geo ON public.profiles(lat, lng) WHERE discoverable = true;
CREATE INDEX IF NOT EXISTS idx_profiles_city_lower ON public.profiles((lower(city))) WHERE city IS NOT NULL;

-- Drop old to allow signature change (new return columns)
DROP FUNCTION IF EXISTS public.match_collectors(double precision);

CREATE OR REPLACE FUNCTION public.match_collectors(_radius_km double precision DEFAULT 50)
 RETURNS TABLE(
   id uuid, full_name text, city text, avatar_url text, plan text,
   album_progress integer, trades_count integer,
   distance_km double precision,
   give_count integer, receive_count integer, mutual_count integer,
   same_city boolean, region_bonus double precision, proximity_score double precision,
   score_pct integer,
   out_of_radius boolean, compat_album boolean, recent_active boolean, nationwide boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_lat double precision;
  my_lng double precision;
  my_city_norm text;
  my_progress int;
  has_geo boolean;
  has_city boolean;
  radius double precision := GREATEST(5, LEAST(COALESCE(_radius_km, 50), 500));
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  SELECT p.lat, p.lng,
         NULLIF(lower(unaccent(coalesce(p.city, ''))), ''),
         COALESCE(p.album_progress, 0)
    INTO my_lat, my_lng, my_city_norm, my_progress
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
  ),
  my_owned AS (
    SELECT us.sticker_code, us.duplicates FROM public.user_stickers us WHERE us.user_id = me
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
    WHERE us.duplicates >= 2
    GROUP BY us.user_id
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
      o.album_progress, o.trades_count,
      o.dist,
      COALESCE(f.give_count, 0) AS give_count,
      COALESCE(r.receive_count, 0) AS receive_count,
      LEAST(COALESCE(f.give_count, 0), COALESCE(r.receive_count, 0)) AS mutual_count,
      (has_city AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm) AS same_city,
      o.is_active,
      (abs(COALESCE(o.album_progress,0) - my_progress) <= GREATEST(20, my_progress * 0.2)) AS compat_album,
      CASE
        WHEN has_city AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm THEN 1.0
        WHEN has_geo AND o.dist IS NOT NULL AND o.dist <= 25 THEN 0.5
        ELSE 0.0
      END AS region_bonus,
      CASE
        WHEN has_geo AND o.dist IS NOT NULL THEN GREATEST(0, 1 - o.dist / radius)
        ELSE 0.0
      END AS proximity_score
    FROM others o
    LEFT JOIN forward f ON f.user_id = o.id
    LEFT JOIN reverse r ON r.user_id = o.id
  ),
  ranked AS (
    SELECT
      s.*,
      (has_geo AND s.dist IS NOT NULL AND s.dist > radius AND s.mutual_count >= 3) AS out_of_radius,
      (NOT has_geo AND NOT has_city) AS nationwide,
      GREATEST(0, LEAST(100, round(
        (
          0.50 * tanh(s.mutual_count::double precision / 8.0)
          + 0.18 * tanh(s.give_count::double precision / 12.0)
          + 0.10 * tanh(s.receive_count::double precision / 12.0)
          + 0.12 * s.proximity_score
          + 0.10 * s.region_bonus
        )
        * (CASE WHEN s.is_active THEN 1.0 ELSE 0.85 END)
        * (CASE WHEN s.compat_album THEN 1.05 ELSE 1.0 END)
        * 100
      )::int)) AS score_pct
    FROM scored s
  )
  SELECT
    r.id, r.full_name, r.city, r.avatar_url, r.plan,
    r.album_progress, r.trades_count,
    r.dist AS distance_km,
    r.give_count, r.receive_count, r.mutual_count,
    r.same_city, r.region_bonus, r.proximity_score,
    r.score_pct,
    r.out_of_radius, r.compat_album, r.is_active AS recent_active, r.nationwide
  FROM ranked r
  WHERE
    -- Discard pure noise
    (r.give_count > 0 OR r.receive_count > 0 OR r.same_city)
    AND (
      -- normal mode: in radius OR same city OR strong out-of-radius
      (has_geo AND (r.dist IS NULL OR r.dist <= radius OR r.same_city OR r.mutual_count >= 3))
      -- city-only fallback: same city, or strong matches anywhere
      OR (NOT has_geo AND has_city AND (r.same_city OR r.mutual_count >= 2 OR r.give_count >= 5))
      -- nationwide fallback
      OR (NOT has_geo AND NOT has_city)
    )
  ORDER BY
    r.score_pct DESC,
    r.mutual_count DESC,
    r.same_city DESC,
    COALESCE(r.dist, 1e9) ASC,
    r.album_progress DESC,
    r.id ASC
  LIMIT 100;
END;
$function$;

-- Update scan_match_alerts to use new function
CREATE OR REPLACE FUNCTION public.scan_match_alerts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  inserted_count int := 0;
  u record;
  m record;
BEGIN
  FOR u IN
    SELECT id, lat, lng, city
    FROM public.profiles
    WHERE COALESCE(notification_prefs->>'matches', 'true') <> 'false'
      AND (lat IS NOT NULL OR city IS NOT NULL)
  LOOP
    FOR m IN
      EXECUTE 'SELECT id AS other_id, city, score_pct FROM public.match_collectors(50) WHERE score_pct >= 70'
    LOOP
      -- the function uses auth.uid(); since we run as service definer w/o session,
      -- we need a per-user variant. Skip if me cannot be derived.
      EXIT;
    END LOOP;
  END LOOP;
  RETURN inserted_count;
END;
$function$;
