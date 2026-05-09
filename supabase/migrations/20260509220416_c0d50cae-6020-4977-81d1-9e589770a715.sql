-- 1. Trade triggers respeitando preferências
CREATE OR REPLACE FUNCTION public.notify_trade_created()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE prefs jsonb;
BEGIN
  SELECT notification_prefs INTO prefs FROM public.profiles WHERE id = NEW.receiver_id;
  IF COALESCE(prefs->>'trades', 'true') = 'false' THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (NEW.receiver_id, 'trade_request', jsonb_build_object('trade_id', NEW.id, 'from', NEW.requester_id));
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_trade_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE prefs jsonb;
BEGIN
  IF NEW.status <> OLD.status THEN
    SELECT notification_prefs INTO prefs FROM public.profiles WHERE id = NEW.requester_id;
    IF COALESCE(prefs->>'trades', 'true') = 'false' THEN RETURN NEW; END IF;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.requester_id, 'trade_' || NEW.status::text, jsonb_build_object('trade_id', NEW.id));
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_trade_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE recipient uuid; prefs jsonb;
BEGIN
  SELECT CASE WHEN t.requester_id = NEW.sender_id THEN t.receiver_id ELSE t.requester_id END
    INTO recipient FROM public.trades t WHERE t.id = NEW.trade_id;
  SELECT notification_prefs INTO prefs FROM public.profiles WHERE id = recipient;
  IF COALESCE(prefs->>'messages', 'true') = 'false' THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (recipient, 'trade_message', jsonb_build_object('trade_id', NEW.trade_id, 'from', NEW.sender_id, 'preview', left(NEW.content, 80)));
  RETURN NEW;
END; $function$;

-- 2. Tabela de deduplicação
CREATE TABLE IF NOT EXISTS public.match_alerts_sent (
  user_id uuid NOT NULL,
  other_id uuid NOT NULL,
  score_pct int NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id)
);
ALTER TABLE public.match_alerts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads alerts" ON public.match_alerts_sent
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Scanner de matches
CREATE OR REPLACE FUNCTION public.scan_match_alerts()
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  inserted_count int := 0;
  u record;
  m record;
  radius double precision := 50;
BEGIN
  FOR u IN
    SELECT id, lat, lng, NULLIF(lower(unaccent(coalesce(city,''))), '') AS city_norm
    FROM public.profiles
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND COALESCE(notification_prefs->>'matches', 'true') <> 'false'
  LOOP
    FOR m IN
      WITH others AS (
        SELECT p.id, p.city,
          (6371*acos(cos(radians(u.lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(u.lng))+sin(radians(u.lat))*sin(radians(p.lat)))) AS dist,
          NULLIF(lower(unaccent(coalesce(p.city,''))), '') AS city_norm
        FROM public.profiles p
        WHERE p.id <> u.id AND p.lat IS NOT NULL AND p.lng IS NOT NULL AND p.discoverable = true
      ),
      my_owned AS (SELECT sticker_code, duplicates FROM public.user_stickers WHERE user_id = u.id),
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
        LEFT JOIN public.user_stickers theirs ON theirs.user_id = us_o.user_id AND theirs.sticker_code = md.sticker_code
        WHERE theirs.user_id IS NULL OR theirs.duplicates < 1
        GROUP BY us_o.user_id
      )
      SELECT
        o.id AS other_id, o.city,
        GREATEST(0, LEAST(100, round((
          0.45 * tanh(LEAST(COALESCE(f.give_count,0), COALESCE(r.receive_count,0))::double precision / 10.0)
          + 0.20 * tanh(COALESCE(f.give_count,0)::double precision / 15.0)
          + 0.10 * tanh(COALESCE(r.receive_count,0)::double precision / 15.0)
          + 0.15 * GREATEST(0, 1 - o.dist / radius)
          + 0.10 * (CASE WHEN u.city_norm IS NOT NULL AND o.city_norm IS NOT NULL AND u.city_norm = o.city_norm THEN 1.0
                         WHEN o.dist <= 25 THEN 0.5 ELSE 0.0 END)
        ) * 100)::int)) AS score_pct
      FROM others o
      LEFT JOIN forward f ON f.user_id = o.id
      LEFT JOIN reverse r ON r.user_id = o.id
      WHERE o.dist <= radius
    LOOP
      IF m.score_pct >= 70 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.match_alerts_sent a
          WHERE a.user_id = u.id AND a.other_id = m.other_id
            AND (a.sent_at > now() - interval '7 days' OR a.score_pct >= m.score_pct - 4)
        ) THEN
          INSERT INTO public.notifications (user_id, type, payload)
          VALUES (u.id, 'match_high', jsonb_build_object('other_id', m.other_id, 'score', m.score_pct, 'city', m.city));
          INSERT INTO public.match_alerts_sent (user_id, other_id, score_pct, sent_at)
          VALUES (u.id, m.other_id, m.score_pct, now())
          ON CONFLICT (user_id, other_id) DO UPDATE SET score_pct = EXCLUDED.score_pct, sent_at = now();
          inserted_count := inserted_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN inserted_count;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.scan_match_alerts() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.scan_match_alerts() TO service_role;