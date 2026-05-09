DROP FUNCTION IF EXISTS public.nearby_collectors(double precision);

CREATE OR REPLACE FUNCTION public.nearby_collectors(_radius_km double precision DEFAULT 50)
 RETURNS TABLE(id uuid, full_name text, city text, avatar_url text, plan text, album_progress integer, trades_count integer, distance_km double precision, match_count integer, reverse_match_count integer, proximity_score double precision, compat_score double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_lat double precision; my_lng double precision;
  radius double precision := GREATEST(5, LEAST(COALESCE(_radius_km, 50), 200));
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.lat, p.lng INTO my_lat, my_lng FROM public.profiles p WHERE p.id = me;
  IF my_lat IS NULL OR my_lng IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH others AS (
    SELECT p.*, (6371*acos(cos(radians(my_lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(my_lng))+sin(radians(my_lat))*sin(radians(p.lat)))) AS dist
    FROM public.profiles p
    WHERE p.id <> me AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.discoverable = true
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
  ORDER BY compat_score DESC, distance_km ASC
  LIMIT 100;
END; $function$;