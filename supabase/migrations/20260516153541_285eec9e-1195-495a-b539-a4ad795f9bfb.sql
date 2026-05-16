CREATE OR REPLACE FUNCTION public.match_preview_stickers(_other uuid, _limit int DEFAULT 5)
RETURNS TABLE(direction text, code text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_age public.age_group;
  other_age public.age_group;
  lim int := GREATEST(1, LEAST(COALESCE(_limit, 5), 200));
BEGIN
  IF me IS NULL OR _other IS NULL OR me = _other THEN
    RETURN;
  END IF;

  SELECT age_group INTO my_age FROM public.profiles WHERE id = me;
  SELECT age_group INTO other_age FROM public.profiles WHERE id = _other;

  -- Peer-age guard, same as match_collectors
  IF NOT (
    (my_age = 'adult' AND (other_age = 'adult' OR other_age IS NULL))
    OR (my_age IN ('child','teen') AND other_age IN ('child','teen'))
    OR (my_age IS NULL AND (other_age = 'adult' OR other_age IS NULL))
  ) THEN
    RETURN;
  END IF;

  -- "give": stickers the OTHER has (>=2 if we don't have it, or >=1 if we don't have it)
  -- and I don't have at all
  RETURN QUERY
  SELECT 'give'::text AS direction, us.sticker_code AS code
  FROM public.user_stickers us
  LEFT JOIN public.user_stickers mine
    ON mine.user_id = me AND mine.sticker_code = us.sticker_code
  WHERE us.user_id = _other
    AND us.duplicates >= 1
    AND mine.user_id IS NULL
  ORDER BY us.sticker_code
  LIMIT lim;

  -- "receive": stickers I have repeated (>=2) that the OTHER is missing
  RETURN QUERY
  SELECT 'receive'::text AS direction, mine.sticker_code AS code
  FROM public.user_stickers mine
  LEFT JOIN public.user_stickers theirs
    ON theirs.user_id = _other AND theirs.sticker_code = mine.sticker_code
  WHERE mine.user_id = me
    AND mine.duplicates >= 2
    AND (theirs.user_id IS NULL OR theirs.duplicates < 1)
  ORDER BY mine.sticker_code
  LIMIT lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_preview_stickers(uuid, int) TO authenticated;