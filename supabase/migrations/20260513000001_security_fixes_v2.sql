-- =============================================================
-- SECURITY FIXES v2 — 2026-05-13
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: profiles — restrição em nível de COLUNA
--
-- O RLS row-level da migration anterior não é suficiente: o scanner
-- verifica se colunas sensíveis são acessíveis a outros usuários
-- autenticados (mesmo que apenas para linhas discoverable=true).
--
-- Solução: REVOKE SELECT nas colunas sensíveis do role 'authenticated'.
-- Colunas seguras (id, full_name, city, avatar_url, plan, album_progress,
-- trades_count, bio, discoverable, age_group, kids_mode, created_at,
-- updated_at) continuam acessíveis para os casos legítimos de UI
-- (ex: perfil do parceiro na tela de troca).
--
-- Acesso ao próprio perfil completo é feito via get_my_profile()
-- SECURITY DEFINER, que roda como superuser e ignora column privileges.
-- ---------------------------------------------------------------
REVOKE SELECT (
  guardian_email,
  guardian_name,
  guardian_consent_at,
  birth_date,
  lat,
  lng,
  location_updated_at,
  notification_prefs
) ON public.profiles FROM authenticated;

-- ---------------------------------------------------------------
-- FIX 2: get_my_profile() — acesso completo ao próprio perfil
--
-- Substitui o select("*") direto na tabela em auth.tsx.
-- Roda como SECURITY DEFINER (ignora column-level REVOKE acima)
-- mas valida auth.uid() = id, então só retorna dados do caller.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
