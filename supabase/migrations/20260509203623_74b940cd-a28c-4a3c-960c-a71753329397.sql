-- Bucket público para imagens das figurinhas
INSERT INTO storage.buckets (id, name, public) VALUES ('sticker-images', 'sticker-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política pública de leitura
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read sticker-images') THEN
    CREATE POLICY "Public read sticker-images" ON storage.objects FOR SELECT USING (bucket_id = 'sticker-images');
  END IF;
END $$;

-- Coluna para a URL da imagem
ALTER TABLE public.stickers ADD COLUMN IF NOT EXISTS image_url text;