CREATE OR REPLACE FUNCTION public.enforce_age_and_kids_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  age_years int;
BEGIN
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

  -- Guard: once a profile has been classified as a minor, it cannot
  -- be escalated to adult by editing birth_date or age_group directly.
  IF TG_OP = 'UPDATE'
     AND OLD.age_group IN ('child','teen')
     AND (NEW.age_group = 'adult' OR NEW.age_group IS NULL) THEN
    RAISE EXCEPTION 'Minor accounts cannot be reclassified as adult. Contact support.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Also block clearing birth_date once set on a minor account
  IF TG_OP = 'UPDATE'
     AND OLD.age_group IN ('child','teen')
     AND OLD.birth_date IS NOT NULL
     AND (NEW.birth_date IS NULL OR NEW.birth_date < OLD.birth_date) THEN
    RAISE EXCEPTION 'Birth date on a minor account cannot be moved earlier or cleared.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Kids mode is forced ON for any minor
  IF NEW.age_group IN ('child','teen') THEN
    NEW.kids_mode := true;
    NEW.discoverable := false;
    NEW.lat := NULL;
    NEW.lng := NULL;
    NEW.bio := NULL;
  END IF;

  RETURN NEW;
END;
$function$;