-- Fix 1: kids_mode = false excludes NULL rows (most users) — use COALESCE
-- Fix 2: Increase privacy jitter from ~333m to ~1km radius
CREATE OR REPLACE FUNCTION public.match_collectors_geo(_radius_km double precision DEFAULT 50)
RETURNS TABLE(
  id uuid, full_name text, city text, avatar_url text, plan text,
  album_progress integer, trades_count integer, distance_km double precision,
  give_count integer, receive_count integer, mutual_count integer,
  same_city boolean, region_bonus double precision, proximity_score double precision,
  score_pct integer, out_of_radius boolean, compat_album boolean,
  recent_active boolean, nationwide boolean,
  lat_approx double precision, lng_approx double precision
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_age public.age_group;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.age_group INTO my_age FROM public.profiles p WHERE p.id = me;

  -- Minors do not see geo coordinates of others
  IF my_age IN ('child','teen') THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    m.id, m.full_name, m.city, m.avatar_url, m.plan,
    m.album_progress, m.trades_count, m.distance_km,
    m.give_count, m.receive_count, m.mutual_count,
    m.same_city, m.region_bonus, m.proximity_score, m.score_pct,
    m.out_of_radius, m.compat_album, m.recent_active, m.nationwide,
    -- Privacy jitter: deterministic per user ID, ~1km radius offset
    -- lat: ±0.009° ≈ ±1km at any latitude
    CASE WHEN p.lat IS NOT NULL THEN
      round((p.lat
        + ((('x'||substr(md5(m.id::text), 1, 8))::bit(32)::int % 2000 - 1000)::double precision / 111000.0)
      )::numeric, 4)::double precision
    ELSE NULL END AS lat_approx,
    -- lng: same offset in km, adjusted for latitude compression
    CASE WHEN p.lng IS NOT NULL THEN
      round((p.lng
        + ((('x'||substr(md5(m.id::text), 9, 8))::bit(32)::int % 2000 - 1000)::double precision
           / (111000.0 * cos(radians(COALESCE(p.lat, 0.0)))))
      )::numeric, 4)::double precision
    ELSE NULL END AS lng_approx
  FROM public.match_collectors(_radius_km) m
  JOIN public.profiles p ON p.id = m.id
  -- Was: p.kids_mode = false — excludes NULL (most users). Fixed:
  WHERE COALESCE(p.kids_mode, false) = false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_collectors_geo(double precision) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_collectors_geo(double precision) TO authenticated;
