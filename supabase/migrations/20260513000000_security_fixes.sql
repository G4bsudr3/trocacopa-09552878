-- =============================================================
-- SECURITY FIXES — 2026-05-13
-- =============================================================

-- ---------------------------------------------------------------
-- FIX 1: profiles SELECT — restringir a próprio perfil OU descobrível
-- Antes: USING (true) → qualquer usuário autenticado lia guardian_email,
--        birth_date, lat/lng, guardian_consent_at de TODOS os perfis.
-- Depois: só o próprio perfil (full) OU perfis com discoverable=true.
-- As funções SECURITY DEFINER (match_collectors, scan_match_alerts etc.)
-- contornam RLS por design; esta política protege consultas diretas.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR COALESCE(discoverable, true) = true
  );

-- ---------------------------------------------------------------
-- FIX 2: guardian_consents — impedir minor de ler o próprio token
-- O token é o segredo que permite o guardião aprovar pelo link de email.
-- Se o minor conseguir lê-lo via RLS SELECT, pode se auto-aprovar
-- chamando guardian_consent_approve(token). Revogar SELECT no nível
-- de coluna impede isso mesmo com a policy "minor sees own consent".
-- As funções SECURITY DEFINER (guardian_consent_approve/lookup/revoke)
-- operam com privilégio elevado e continuam funcionando normalmente.
-- ---------------------------------------------------------------
REVOKE SELECT (token) ON public.guardian_consents FROM authenticated;

-- ---------------------------------------------------------------
-- FIX 3: user_stickers SELECT — restringir ao próprio usuário
-- Antes: USING (true) → qualquer autenticado via a coleção completa
--        de figurinhas de qualquer outro usuário.
-- Depois: cada usuário vê apenas as próprias figurinhas.
-- Impacto zero no matching: match_collectors / nearby_collectors /
-- scan_match_alerts / get_trade_stickers são SECURITY DEFINER e
-- acessam a tabela com privilégio elevado, ignorando RLS.
-- Impacto zero no frontend: todas as queries diretas já usam
-- .eq("user_id", currentUser.id).
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ler user_stickers" ON public.user_stickers;

CREATE POLICY "user_stickers_select_own"
  ON public.user_stickers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
