## Objetivo
Hoje o `nearby_collectors` ordena por `match_count DESC, distance ASC` dentro de 25 km. Vamos transformar a proximidade em parte do **score de compatibilidade**, não só desempate, e dar mais controle ao usuário.

## 1. Score de compatibilidade (banco)
Migração para reescrever `public.nearby_collectors(_radius_km, _max_distance_km)`:

- Continuar calculando `match_count` (figurinhas que o outro tem repetidas e eu preciso) e `dist_km`.
- Calcular também `reverse_match_count` (figurinhas que EU tenho repetidas e o outro precisa) — troca bidirecional.
- Novo campo derivado `proximity_score = GREATEST(0, 1 - dist_km / _radius_km)` (1 = colado em mim, 0 = na borda do raio).
- Novo `compat_score`:
  ```
  compat_score = 
      0.55 * LEAST(match_count, 30) / 30        -- o que ele me oferece
    + 0.25 * LEAST(reverse_match_count, 30) / 30 -- o que eu ofereço
    + 0.20 * proximity_score                     -- proximidade
  ```
  Pesos pensados para que matches ganhem de quase tudo, mas dois usuários com matches parecidos sejam ordenados pelo mais perto.
- `ORDER BY compat_score DESC, dist_km ASC`.
- Retornar colunas extras: `reverse_match_count`, `compat_score`, `proximity_score`.

## 2. Raio configurável
- Aceitar `_radius_km` de 5 a 200 (default 50).
- UI ganha um seletor de raio (chips: 10 / 25 / 50 / 100 km) que é passado para o RPC.

## 3. UI `/near`
- Cabeçalho: "Ordenado por compatibilidade (matches + proximidade)".
- Cada card mostra: distância, match (eles têm pra mim), "você oferece N pra ele", e barra de compatibilidade (`compat_score * 100`%).
- Badge "🎯 Perto" quando `dist_km < raio * 0.25`.
- Estado vazio sugere aumentar raio.

## 4. Tipos
Atualizar `NearbyRow` em `_app.near.tsx` com os campos novos. `types.ts` é regenerado pela migração.

## Fora do escopo
- Mudar tabelas, RLS, ou estrutura do catálogo.
- Realtime / notificações.
- Match em lote nos /trades.

## Arquivos
- `supabase/migrations/<novo>.sql` — substitui a função `nearby_collectors`.
- `src/routes/_app.near.tsx` — seletor de raio + novo card com score.
