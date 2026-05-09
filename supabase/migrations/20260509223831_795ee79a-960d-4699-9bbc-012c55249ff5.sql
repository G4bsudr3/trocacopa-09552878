CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (id, full_name, city, avatar_url)
  VALUES (
    new.id,
    COALESCE(meta->>'full_name', meta->>'name', split_part(new.email, '@', 1)),
    NULLIF(meta->>'city', ''),
    NULLIF(meta->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;