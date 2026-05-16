-- 1) Normalize empty image_url to NULL so the generator picks them up
UPDATE public.stickers SET image_url = NULL WHERE image_url = '';

-- 2) Grant admin role to juan.kleberstyle@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'juan.kleberstyle@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;