
-- Friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  source text NOT NULL DEFAULT 'invite',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),
  CONSTRAINT friendships_unique UNIQUE (user_a, user_b)
);
CREATE INDEX idx_friendships_user_a ON public.friendships(user_a);
CREATE INDEX idx_friendships_user_b ON public.friendships(user_b);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "users delete own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Invites
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid,
  accepted_at timestamptz
);
CREATE INDEX idx_invites_inviter ON public.invites(inviter_id);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads invites" ON public.invites
  FOR SELECT TO authenticated USING (auth.uid() = inviter_id);
CREATE POLICY "owner creates invites" ON public.invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);

-- accept_invite SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.accept_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  inv record;
  ua uuid; ub uuid;
  inviter_name text;
  invitee_name text;
BEGIN
  IF me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO inv FROM public.invites WHERE code = _code LIMIT 1;
  IF inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF inv.inviter_id = me THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite', 'inviter_id', inv.inviter_id);
  END IF;

  ua := LEAST(inv.inviter_id, me);
  ub := GREATEST(inv.inviter_id, me);

  INSERT INTO public.friendships (user_a, user_b, source)
  VALUES (ua, ub, 'invite')
  ON CONFLICT (user_a, user_b) DO NOTHING;

  IF inv.accepted_at IS NULL THEN
    UPDATE public.invites SET accepted_by = me, accepted_at = now() WHERE id = inv.id;
  END IF;

  SELECT full_name INTO inviter_name FROM public.profiles WHERE id = inv.inviter_id;
  SELECT full_name INTO invitee_name FROM public.profiles WHERE id = me;

  INSERT INTO public.notifications (user_id, type, payload) VALUES
    (inv.inviter_id, 'friend_added', jsonb_build_object('friend_id', me, 'name', COALESCE(invitee_name, 'novo amigo'))),
    (me, 'friend_added', jsonb_build_object('friend_id', inv.inviter_id, 'name', COALESCE(inviter_name, 'novo amigo')));

  RETURN jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id);
END;
$$;

-- Trades meet fields
ALTER TABLE public.trades
  ADD COLUMN meet_at timestamptz,
  ADD COLUMN meet_place text,
  ADD COLUMN meet_status text,
  ADD COLUMN meet_proposed_by uuid;

CREATE OR REPLACE FUNCTION public.notify_trade_meet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recipient uuid;
BEGIN
  IF NEW.meet_at IS DISTINCT FROM OLD.meet_at
     OR NEW.meet_place IS DISTINCT FROM OLD.meet_place
     OR NEW.meet_status IS DISTINCT FROM OLD.meet_status THEN
    recipient := CASE WHEN NEW.meet_proposed_by = NEW.requester_id THEN NEW.receiver_id ELSE NEW.requester_id END;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (recipient, 'trade_meet', jsonb_build_object(
      'trade_id', NEW.id,
      'meet_at', NEW.meet_at,
      'meet_place', NEW.meet_place,
      'meet_status', NEW.meet_status
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trades_notify_meet
AFTER UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.notify_trade_meet();
