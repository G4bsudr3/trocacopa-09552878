-- RPC que retorna as figurinhas de ambos os participantes de uma troca.
-- SECURITY DEFINER para contornar RLS, mas valida que o chamador é participante.
CREATE OR REPLACE FUNCTION public.get_trade_stickers(_trade_id uuid)
RETURNS TABLE(user_id uuid, sticker_code text, duplicates integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  other_id uuid;
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  SELECT CASE WHEN t.requester_id = me THEN t.receiver_id ELSE t.requester_id END
    INTO other_id
    FROM public.trades t
   WHERE t.id = _trade_id
     AND (t.requester_id = me OR t.receiver_id = me);

  IF other_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT us.user_id, us.sticker_code, us.duplicates
    FROM public.user_stickers us
   WHERE us.user_id IN (me, other_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_trade_stickers(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_trade_stickers(uuid) TO authenticated;
