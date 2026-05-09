
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.pro_waitlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self insert waitlist" ON public.pro_waitlist;
CREATE POLICY "self insert waitlist" ON public.pro_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "self select waitlist" ON public.pro_waitlist;
CREATE POLICY "self select waitlist" ON public.pro_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.nearby_collectors(_radius_km double precision DEFAULT 25)
 RETURNS TABLE(id uuid, full_name text, city text, avatar_url text, plan text, album_progress integer, trades_count integer, distance_km double precision, match_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  my_lat double precision; my_lng double precision;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.lat, p.lng INTO my_lat, my_lng FROM public.profiles p WHERE p.id = me;
  IF my_lat IS NULL OR my_lng IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH others AS (
    SELECT p.*, (6371*acos(cos(radians(my_lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(my_lng))+sin(radians(my_lat))*sin(radians(p.lat)))) AS dist
    FROM public.profiles p WHERE p.id <> me AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.discoverable = true
  ),
  my_needs AS (
    SELECT s.code FROM public.stickers s
    LEFT JOIN public.user_stickers us ON us.sticker_code = s.code AND us.user_id = me
    WHERE us.user_id IS NULL
  ),
  matches AS (
    SELECT us.user_id, count(*)::int AS match_count
    FROM public.user_stickers us
    JOIN my_needs n ON n.code = us.sticker_code
    WHERE us.duplicates >= 1 GROUP BY us.user_id
  )
  SELECT o.id, o.full_name, o.city, o.avatar_url, o.plan, o.album_progress, o.trades_count, o.dist, COALESCE(m.match_count,0)
  FROM others o LEFT JOIN matches m ON m.user_id = o.id
  WHERE o.dist <= _radius_km
  ORDER BY m.match_count DESC NULLS LAST, o.dist ASC LIMIT 50;
END; $function$;
