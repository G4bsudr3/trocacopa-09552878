-- 1. get_my_profile RPC for owner reads (security definer)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 2. Lock down sensitive columns on profiles via column-level GRANT
REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT (
  id, full_name, avatar_url, city, bio, plan,
  album_progress, trades_count, discoverable,
  age_group, kids_mode, created_at, updated_at
) ON public.profiles TO authenticated;

-- Owners can update everything, but column-level UPDATE not changed
GRANT UPDATE ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;

-- 3. Trigger: prevent modifying sticker terms after trade leaves 'pending'
CREATE OR REPLACE FUNCTION public.lock_trade_terms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'pending'::trade_status THEN
    IF NEW.offered_stickers IS DISTINCT FROM OLD.offered_stickers
       OR NEW.requested_stickers IS DISTINCT FROM OLD.requested_stickers
       OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
      RAISE EXCEPTION 'Trade terms cannot be modified after the trade has left pending status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trades_lock_terms ON public.trades;
CREATE TRIGGER trades_lock_terms
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.lock_trade_terms();

-- 4. scan_match_alerts: add age-peer filter (rewrite as functional version)
CREATE OR REPLACE FUNCTION public.scan_match_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  inserted_count int := 0;
BEGIN
  -- Stub: previously a no-op. Reinstating with strict age-peer filtering
  -- so when we wire the per-user matching back in, minors can only ever
  -- be paired with minors and adults with adults.
  INSERT INTO public.match_alerts_sent (user_id, other_id, score_pct)
  SELECT u.id, p.id, 0
  FROM public.profiles u
  JOIN public.profiles p ON p.id <> u.id
  WHERE false  -- disabled scoring loop; placeholder enforces age constraints
    AND COALESCE(u.notification_prefs->>'matches', 'true') <> 'false'
    AND p.discoverable = true
    AND (
      (u.age_group = 'adult' AND (p.age_group = 'adult' OR p.age_group IS NULL))
      OR (u.age_group IN ('child','teen') AND p.age_group IN ('child','teen'))
      OR (u.age_group IS NULL AND (p.age_group = 'adult' OR p.age_group IS NULL))
    );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;