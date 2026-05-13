
-- 1) PROFILES: restrict direct SELECT to owner only; expose safe public view
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Safe public view (no PII: no birth_date, lat/lng, guardian_*, notification_prefs, kids_mode)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, full_name, city, avatar_url, plan,
  album_progress, trades_count, age_group, discoverable
FROM public.profiles
WHERE COALESCE(discoverable, true) = true;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2) GUARDIAN_CONSENTS: hide token from the minor (guardian receives it via email)
REVOKE SELECT (token) ON public.guardian_consents FROM authenticated, anon;

-- 3) Lock-trade-terms function: pin search_path
CREATE OR REPLACE FUNCTION public.lock_trade_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;
