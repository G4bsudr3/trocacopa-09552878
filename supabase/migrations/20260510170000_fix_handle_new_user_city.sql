
-- Fix handle_new_user trigger to also persist city and birth_date from signup metadata.
-- Previously only full_name and avatar_url were saved, causing city to be lost
-- when email confirmation is required (session = null at signup time).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, city, birth_date, guardian_email, guardian_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NULLIF(TRIM(NEW.raw_user_meta_data->>'city'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'birth_date'), '')::date,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'guardian_email'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'guardian_name'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name    = COALESCE(EXCLUDED.full_name, profiles.full_name),
    city         = COALESCE(EXCLUDED.city, profiles.city),
    birth_date   = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
    guardian_email = COALESCE(EXCLUDED.guardian_email, profiles.guardian_email),
    guardian_name  = COALESCE(EXCLUDED.guardian_name, profiles.guardian_name);
  RETURN NEW;
END;
$$;
