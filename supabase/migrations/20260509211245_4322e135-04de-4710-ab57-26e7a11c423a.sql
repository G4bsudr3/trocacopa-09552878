
ALTER TABLE public.stickers
  ADD COLUMN IF NOT EXISTS player_name text,
  ADD COLUMN IF NOT EXISTS player_name_source text,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric,
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_stickers_player_name_trgm
  ON public.stickers USING gin (player_name gin_trgm_ops);
