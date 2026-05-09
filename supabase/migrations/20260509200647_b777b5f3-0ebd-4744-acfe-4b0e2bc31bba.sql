
-- ==========================================================
-- PROFILES: campos extras
-- ==========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"trades":true,"messages":true,"matches":true}'::jsonb;

-- ==========================================================
-- STICKERS: catálogo público
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.stickers (
  number int PRIMARY KEY CHECK (number BETWEEN 1 AND 640),
  name text NOT NULL,
  team text NOT NULL,
  group_letter text NOT NULL
);

ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stickers visíveis a qualquer autenticado"
  ON public.stickers FOR SELECT TO authenticated USING (true);

-- Seed 640 figurinhas
DO $$
DECLARE
  teams text[] := ARRAY['Brasil','Argentina','França','Alemanha','Espanha','Inglaterra','Portugal','Holanda','Itália','Croácia','Uruguai','México','EUA','Canadá','Japão','Coreia do Sul'];
  players text[] := ARRAY['Vinicius Jr.','Rodrygo','Endrick','Casemiro','Alisson','Marquinhos','Messi','Di María','Lautaro','Mbappé','Griezmann','Dembélé','Musiala','Wirtz','Kane','Bellingham','Foden','Saka','Pedri','Yamal','Rodri','Ronaldo','Bruno Fernandes','Leão'];
  i int;
BEGIN
  FOR i IN 1..640 LOOP
    INSERT INTO public.stickers (number, name, team, group_letter)
    VALUES (
      i,
      players[1 + (i % array_length(players,1))],
      teams[1 + (i % array_length(teams,1))],
      chr(65 + (i % 12))
    )
    ON CONFLICT (number) DO NOTHING;
  END LOOP;
END $$;

-- ==========================================================
-- USER_STICKERS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.user_stickers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_number int NOT NULL REFERENCES public.stickers(number) ON DELETE CASCADE,
  duplicates int NOT NULL DEFAULT 1 CHECK (duplicates >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sticker_number)
);

ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler user_stickers"
  ON public.user_stickers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário insere as suas figurinhas"
  ON public.user_stickers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza as suas figurinhas"
  ON public.user_stickers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove as suas figurinhas"
  ON public.user_stickers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_stickers_user ON public.user_stickers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker ON public.user_stickers (sticker_number);

-- Trigger: recalcular album_progress
CREATE OR REPLACE FUNCTION public.refresh_album_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  cnt int;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  SELECT count(*) INTO cnt FROM public.user_stickers WHERE user_id = uid;
  UPDATE public.profiles SET album_progress = cnt, updated_at = now() WHERE id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_stickers_progress ON public.user_stickers;
CREATE TRIGGER trg_user_stickers_progress
AFTER INSERT OR UPDATE OR DELETE ON public.user_stickers
FOR EACH ROW EXECUTE FUNCTION public.refresh_album_progress();

-- ==========================================================
-- TRADES
-- ==========================================================
CREATE TYPE public.trade_status AS ENUM ('pending','accepted','declined','completed','cancelled');

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offered_stickers int[] NOT NULL DEFAULT '{}',
  requested_stickers int[] NOT NULL DEFAULT '{}',
  status public.trade_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> receiver_id)
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem suas trocas"
  ON public.trades FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, receiver_id));

CREATE POLICY "Solicitante cria troca"
  ON public.trades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Participantes atualizam troca"
  ON public.trades FOR UPDATE TO authenticated
  USING (auth.uid() IN (requester_id, receiver_id))
  WITH CHECK (auth.uid() IN (requester_id, receiver_id));

CREATE INDEX IF NOT EXISTS idx_trades_requester ON public.trades (requester_id);
CREATE INDEX IF NOT EXISTS idx_trades_receiver ON public.trades (receiver_id);

-- ==========================================================
-- TRADE MESSAGES
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.trade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_trade_participant(_trade uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.id = _trade AND _user IN (t.requester_id, t.receiver_id)
  )
$$;

CREATE POLICY "Participantes leem mensagens da troca"
  ON public.trade_messages FOR SELECT TO authenticated
  USING (public.is_trade_participant(trade_id, auth.uid()));

CREATE POLICY "Participantes enviam mensagens"
  ON public.trade_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_trade_participant(trade_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_trade_messages_trade ON public.trade_messages (trade_id, created_at);

-- ==========================================================
-- NOTIFICATIONS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas notificações"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza suas notificações"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove suas notificações"
  ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- Triggers para gerar notificações
CREATE OR REPLACE FUNCTION public.notify_trade_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (NEW.receiver_id, 'trade_request', jsonb_build_object('trade_id', NEW.id, 'from', NEW.requester_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_notify ON public.trades;
CREATE TRIGGER trg_trade_notify
AFTER INSERT ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_created();

CREATE OR REPLACE FUNCTION public.notify_trade_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      CASE WHEN NEW.status IN ('accepted','completed') THEN NEW.requester_id ELSE NEW.requester_id END,
      'trade_' || NEW.status::text,
      jsonb_build_object('trade_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_status ON public.trades;
CREATE TRIGGER trg_trade_status
AFTER UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_status();

CREATE OR REPLACE FUNCTION public.notify_trade_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT CASE WHEN t.requester_id = NEW.sender_id THEN t.receiver_id ELSE t.requester_id END
    INTO recipient FROM public.trades t WHERE t.id = NEW.trade_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (recipient, 'trade_message', jsonb_build_object('trade_id', NEW.trade_id, 'from', NEW.sender_id, 'preview', left(NEW.content, 80)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_msg_notify ON public.trade_messages;
CREATE TRIGGER trg_trade_msg_notify
AFTER INSERT ON public.trade_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_message();

-- ==========================================================
-- REVIEWS
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> reviewed_id),
  UNIQUE (reviewer_id, trade_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews visíveis a autenticados"
  ON public.reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário cria suas reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Usuário edita suas reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

-- ==========================================================
-- NEARBY COLLECTORS
-- ==========================================================
CREATE OR REPLACE FUNCTION public.nearby_collectors(_radius_km double precision DEFAULT 25)
RETURNS TABLE (
  id uuid,
  full_name text,
  city text,
  avatar_url text,
  plan text,
  album_progress int,
  trades_count int,
  distance_km double precision,
  match_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  my_lat double precision;
  my_lng double precision;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT p.lat, p.lng INTO my_lat, my_lng FROM public.profiles p WHERE p.id = me;
  IF my_lat IS NULL OR my_lng IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH others AS (
    SELECT p.*,
      ( 6371 * acos(
          cos(radians(my_lat)) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(my_lng)) +
          sin(radians(my_lat)) * sin(radians(p.lat))
      )) AS dist
    FROM public.profiles p
    WHERE p.id <> me AND p.lat IS NOT NULL AND p.lng IS NOT NULL
  ),
  my_needs AS (
    SELECT s.number FROM public.stickers s
    LEFT JOIN public.user_stickers us ON us.sticker_number = s.number AND us.user_id = me
    WHERE us.user_id IS NULL
  ),
  matches AS (
    SELECT us.user_id, count(*)::int AS match_count
    FROM public.user_stickers us
    JOIN my_needs n ON n.number = us.sticker_number
    WHERE us.duplicates >= 1
    GROUP BY us.user_id
  )
  SELECT o.id, o.full_name, o.city, o.avatar_url, o.plan, o.album_progress, o.trades_count,
         o.dist AS distance_km, COALESCE(m.match_count, 0) AS match_count
  FROM others o
  LEFT JOIN matches m ON m.user_id = o.id
  WHERE o.dist <= _radius_km
  ORDER BY m.match_count DESC NULLS LAST, o.dist ASC
  LIMIT 50;
END;
$$;

-- ==========================================================
-- AVATARS BUCKET
-- ==========================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars públicos"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

CREATE POLICY "Usuário envia próprio avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário atualiza próprio avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuário remove próprio avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==========================================================
-- REALTIME
-- ==========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
