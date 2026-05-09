-- 1) Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Admin write policies for stickers
CREATE POLICY "Admins manage stickers insert"
ON public.stickers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage stickers update"
ON public.stickers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage stickers delete"
ON public.stickers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Admin storage policies for sticker-images
CREATE POLICY "Admins upload sticker images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sticker-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update sticker images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sticker-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete sticker images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sticker-images' AND public.has_role(auth.uid(), 'admin'));