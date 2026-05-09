CREATE INDEX IF NOT EXISTS idx_stickers_player_name_trgm
  ON public.stickers USING gin (lower(coalesce(player_name,'')) public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stickers_country_position
  ON public.stickers (lower(country_name), position) WHERE kind = 'player';