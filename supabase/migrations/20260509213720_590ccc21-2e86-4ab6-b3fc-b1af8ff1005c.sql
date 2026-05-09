CREATE INDEX IF NOT EXISTS stickers_country_kind_idx ON public.stickers(country_code, kind);
CREATE INDEX IF NOT EXISTS stickers_group_idx ON public.stickers(group_letter);
CREATE INDEX IF NOT EXISTS stickers_position_idx ON public.stickers("position");
CREATE INDEX IF NOT EXISTS stickers_player_name_trgm ON public.stickers USING gin (player_name gin_trgm_ops);