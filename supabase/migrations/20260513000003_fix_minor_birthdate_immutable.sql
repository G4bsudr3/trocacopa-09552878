-- =============================================================
-- FIX: enforce_age_and_kids_mode — pin birth_date for known minors
--
-- Vulnerability: an authenticated minor (age_group = 'child'|'teen')
-- could UPDATE their own birth_date to a fake adult date (e.g. 1990-01-01).
-- The trigger would then compute age_years >= 18, set age_group = 'adult',
-- and skip the kids_mode/discoverable/location enforcement entirely —
-- defeating all ECA Digital / Lei Felca child-safety controls.
--
-- Fix: at the start of any UPDATE, if OLD.age_group is a minor group,
-- silently revert both birth_date and age_group to the previous values
-- before the age calculation runs. The rest of the trigger logic is
-- unchanged; kids_mode / discoverable / lat / lng enforcement still fires.
-- =============================================================

CREATE OR REPLACE FUNCTION public.enforce_age_and_kids_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  age_years int;
BEGIN
  -- SECURITY: once a user is established as a minor, their birth_date
  -- and age_group are immutable via normal UPDATE (service_role can still
  -- correct a data-entry error by using a dedicated admin RPC).
  IF TG_OP = 'UPDATE' AND OLD.age_group IN ('child', 'teen') THEN
    NEW.birth_date := OLD.birth_date;
    NEW.age_group  := OLD.age_group;
  END IF;

  IF NEW.birth_date IS NOT NULL THEN
    age_years := date_part('year', age(NEW.birth_date))::int;
    IF age_years < 13 THEN
      NEW.age_group := 'child';
    ELSIF age_years < 18 THEN
      NEW.age_group := 'teen';
    ELSE
      NEW.age_group := 'adult';
    END IF;
  END IF;

  -- Kids mode is forced ON for any minor
  IF NEW.age_group IN ('child', 'teen') THEN
    NEW.kids_mode    := true;
    NEW.discoverable := false;
    NEW.lat          := NULL;
    NEW.lng          := NULL;
    NEW.bio          := NULL;
  END IF;

  RETURN NEW;
END;
$$;
