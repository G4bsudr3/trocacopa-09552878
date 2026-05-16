REVOKE EXECUTE ON FUNCTION public.match_preview_stickers(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_preview_stickers(uuid, int) TO authenticated;