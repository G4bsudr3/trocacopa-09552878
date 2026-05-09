CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.match_collectors(_radius_km double precision DEFAULT 50)
 RETURNS TABLE(
   id uuid,
   full_name text,
   city text,
   avatar_url text,
   plan text,
   album_progress integer,
   trades_count integer,
   distance_km double precision,
   give_count integer,
   receive_count integer,
   mutual_count integer,
   same_city boolean,
   region_bonus double precision,
   proximity_score double precision,
   score_pct integer
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
  radius double precision := GREATEST(5, LEAST(COALESCE(_radius_km, 50), 200));
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  SELECT p.lat, p.lng, NULLIF(lower(unaccent(coalesce(p.city, ''))), '')
    INTO my_lat, my_lng, my_city_norm
    FROM public.profiles p WHERE p.id = me;

  IF my_lat IS NULL OR my_lng IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH others AS (
    SELECT
      p.*,
      (6371*acos(
        cos(radians(my_lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(my_lng))
        + sin(radians(my_lat))*sin(radians(p.lat))
      )) AS dist,
      NULLIF(lower(unaccent(coalesce(p.city, ''))), '') AS city_norm
    FROM public.profiles p
    WHERE p.id <> me
      AND p.lat IS NOT NULL AND p.lng IS NOT NULL
      AND p.discoverable = true
  ),
  my_owned AS (
    SELECT us.sticker_code, us.duplicates
    FROM public.user_stickers us
    WHERE us.user_id = me
  ),
  my_dupes AS (
    SELECT sticker_code FROM my_owned WHERE duplicates >= 2
  ),
  my_needs AS (
    SELECT s.code
    FROM public.stickers s
    LEFT JOIN my_owned mo ON mo.sticker_code = s.code
    WHERE mo.sticker_code IS NULL OR mo.duplicates < 1
  ),
  my_missing AS (
    SELECT count(*)::int AS n FROM my_needs
  ),
  -- Figurinhas que ele tem como repetida e que eu preciso
  forward AS (
    SELECT us.user_id, count(*)::int AS give_count
    FROM public.user_stickers us
    JOIN my_needs n ON n.code = us.sticker_code
    WHERE us.duplicates >= 2
    GROUP BY us.user_id
  ),
  -- Figurinhas que eu tenho como repetida e ele não tem
  reverse AS (
    SELECT us_other.user_id, count(*)::int AS receive_count
    FROM (SELECT DISTINCT user_id FROM public.user_stickers) us_other
    JOIN my_dupes md ON true
    LEFT JOIN public.user_stickers theirs
      ON theirs.user_id = us_other.user_id AND theirs.sticker_code = md.sticker_code
    WHERE theirs.user_id IS NULL OR theirs.duplicates < 1
    GROUP BY us_other.user_id
  )
  SELECT
    o.id,
    o.full_name,
    o.city,
    o.avatar_url,
    o.plan,
    o.album_progress,
    o.trades_count,
    o.dist AS distance_km,
    COALESCE(f.give_count, 0) AS give_count,
    COALESCE(r.receive_count, 0) AS receive_count,
    LEAST(COALESCE(f.give_count, 0), COALESCE(r.receive_count, 0)) AS mutual_count,
    (my_city_norm IS NOT NULL AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm) AS same_city,
    CASE
      WHEN my_city_norm IS NOT NULL AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm THEN 1.0
      WHEN o.dist <= 25 THEN 0.5
      ELSE 0.0
    END AS region_bonus,
    GREATEST(0, 1 - o.dist / radius) AS proximity_score,
    GREATEST(0, LEAST(100, round((
      0.45 * tanh(LEAST(COALESCE(f.give_count, 0), COALESCE(r.receive_count, 0))::double precision / 10.0)
      + 0.20 * tanh(COALESCE(f.give_count, 0)::double precision / 15.0)
      + 0.10 * tanh(COALESCE(r.receive_count, 0)::double precision / 15.0)
      + 0.15 * GREATEST(0, 1 - o.dist / radius)
      + 0.10 * (CASE
          WHEN my_city_norm IS NOT NULL AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm THEN 1.0
          WHEN o.dist <= 25 THEN 0.5
          ELSE 0.0
        END)
    ) * 100)::int)) AS score_pct
  FROM others o
  LEFT JOIN forward f ON f.user_id = o.id
  LEFT JOIN reverse r ON r.user_id = o.id
  WHERE
    o.dist <= radius
    OR (my_city_norm IS NOT NULL AND o.city_norm IS NOT NULL AND my_city_norm = o.city_norm)
    OR LEAST(COALESCE(f.give_count, 0), COALESCE(r.receive_count, 0)) >= 1
  ORDER BY
    score_pct DESC,
    mutual_count DESC,
    same_city DESC,
    distance_km ASC
  LIMIT 100;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_collectors(double precision) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.match_collectors(double precision) TO authenticated;