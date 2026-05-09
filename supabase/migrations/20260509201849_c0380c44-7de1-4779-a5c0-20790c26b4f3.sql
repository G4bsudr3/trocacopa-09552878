-- Reset stickers + dependentes
DELETE FROM public.trade_messages;
DELETE FROM public.trades;
DELETE FROM public.user_stickers;

ALTER TABLE public.user_stickers DROP CONSTRAINT IF EXISTS user_stickers_pkey;
ALTER TABLE public.user_stickers DROP COLUMN IF EXISTS sticker_number;
ALTER TABLE public.user_stickers ADD COLUMN sticker_code text NOT NULL;
ALTER TABLE public.user_stickers ADD CONSTRAINT user_stickers_pkey PRIMARY KEY (user_id, sticker_code);

ALTER TABLE public.trades DROP COLUMN offered_stickers;
ALTER TABLE public.trades DROP COLUMN requested_stickers;
ALTER TABLE public.trades ADD COLUMN offered_stickers text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.trades ADD COLUMN requested_stickers text[] NOT NULL DEFAULT '{}';

DROP TABLE public.stickers CASCADE;
CREATE TABLE public.stickers (
  code text PRIMARY KEY,
  country_code text NOT NULL,
  country_name text NOT NULL,
  position int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cover','country','history','special')),
  group_letter text NOT NULL,
  flag_emoji text NOT NULL DEFAULT ''
);
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stickers visíveis a qualquer autenticado" ON public.stickers FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_user_stickers_progress ON public.user_stickers;
CREATE TRIGGER trg_user_stickers_progress
AFTER INSERT OR UPDATE OR DELETE ON public.user_stickers
FOR EACH ROW EXECUTE FUNCTION public.refresh_album_progress();

CREATE OR REPLACE FUNCTION public.nearby_collectors(_radius_km double precision DEFAULT 25)
 RETURNS TABLE(id uuid, full_name text, city text, avatar_url text, plan text, album_progress integer, trades_count integer, distance_km double precision, match_count integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    FROM public.profiles p WHERE p.id <> me AND p.lat IS NOT NULL AND p.lng IS NOT NULL
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
END; $$;