-- Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-contributions', 'user-contributions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "contrib owner insert" ON storage.objects;
CREATE POLICY "contrib owner insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-contributions'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.kids_mode = false)
);

DROP POLICY IF EXISTS "contrib owner read" ON storage.objects;
CREATE POLICY "contrib owner read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-contributions'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "contrib owner delete" ON storage.objects;
CREATE POLICY "contrib owner delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-contributions'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

-- Enum for status
DO $$ BEGIN
  CREATE TYPE public.contribution_status AS ENUM ('pending','approved','rejected','used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contribution_kind AS ENUM ('avatar','sticker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Metadata table
CREATE TABLE IF NOT EXISTS public.user_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.contribution_kind NOT NULL,
  storage_path text NOT NULL,
  sticker_code text NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  status public.contribution_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_contributions_user ON public.user_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contributions_status ON public.user_contributions(status);
CREATE INDEX IF NOT EXISTS idx_user_contributions_sticker ON public.user_contributions(sticker_code);

ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner inserts contribution" ON public.user_contributions;
CREATE POLICY "owner inserts contribution" ON public.user_contributions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.kids_mode = false)
);

DROP POLICY IF EXISTS "owner or admin reads contribution" ON public.user_contributions;
CREATE POLICY "owner or admin reads contribution" ON public.user_contributions
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "owner or admin deletes contribution" ON public.user_contributions;
CREATE POLICY "owner or admin deletes contribution" ON public.user_contributions
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin updates contribution" ON public.user_contributions;
CREATE POLICY "admin updates contribution" ON public.user_contributions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));