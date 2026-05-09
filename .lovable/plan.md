
# Match altamente funcional — plano completo

Objetivo: deixar o motor de Match (`match_collectors`) consistente em todos os cenários — ranking certeiro, rápido, com filtros úteis, e funcionando mesmo quando o usuário não tem cidade ou geolocalização.

## 1) Ranking mais inteligente (SQL `match_collectors`)

Ajustes na função para que "melhor parceiro de troca" apareça sempre no topo:

- **Saturação justa**: manter `tanh` mas re-balancear pesos para priorizar trocas 1-1 (mútuas) sobre listas unilaterais grandes:
  - mútuo 0.50, give 0.18, receive 0.10, proximidade 0.12, região 0.10.
- **Bônus de progresso compatível**: pequenos bônus quando ambos têm álbum em estágio parecido (faixa de 20%), para evitar pareamento com perfis vazios/abandonados.
- **Penalidade por inatividade**: se `profiles.updated_at` > 60 dias, multiplicar score por 0.85.
- **Cobertura completa**: incluir também colecionadores fora do raio quando `mutual_count >= 3` (matches fortes a distância continuam visíveis), com flag `out_of_radius`.
- **Desempate determinístico**: `score_pct DESC, mutual_count DESC, same_city DESC, distance_km ASC, album_progress DESC, id ASC`.
- **Filtro mínimo**: descartar linhas com `give_count = 0 AND receive_count = 0 AND NOT same_city` (ruído puro).

Retornar campos novos: `out_of_radius boolean`, `compat_album boolean`, `recent_active boolean`.

## 2) Robustez sem localização

Hoje a função retorna vazio quando o usuário não tem `lat/lng`. Vamos:

- **Fallback por cidade**: se `lat/lng` for null mas `city` existir, calcular o match por cidade (`same_city`) + `give/receive`, sem proximidade — score ainda funciona com peso redistribuído.
- **Fallback global**: se nem cidade existir, retornar top matches por compatibilidade pura (mútuo + give + receive), limitado a 30, marcando `nationwide = true`.
- **UI `/near`**: parar de bloquear a tela quando faltar `lat`. Mostrar banner "Ative localização para ver distância", mas já exibir os matches.

## 3) Performance e índices

Adicionar (idempotentes):

- `CREATE INDEX IF NOT EXISTS idx_user_stickers_user ON user_stickers(user_id);`
- `CREATE INDEX IF NOT EXISTS idx_user_stickers_code_dup ON user_stickers(sticker_code) WHERE duplicates >= 2;`
- `CREATE INDEX IF NOT EXISTS idx_profiles_geo ON profiles(lat, lng) WHERE discoverable = true;`
- `CREATE INDEX IF NOT EXISTS idx_profiles_city_norm ON profiles((lower(unaccent(city)))) WHERE city IS NOT NULL;`

Reescrever o CTE `reverse` que hoje faz `JOIN ON true` (custoso em larga escala) usando agregação direta sobre `user_stickers` filtrada pelas minhas duplicadas.

## 4) Filtros e controles na UI (`/near`)

- Chips de raio: já existem (10/25/50/100). Adicionar chip "Brasil" (sem raio, usa fallback global).
- Toggle "Só mesma cidade".
- Toggle "Só com troca 1-1" (filtra `mutual_count >= 1`).
- Ordenação: padrão "Melhor match"; alternativa "Mais perto".
- Badge novo "🌎 Fora do raio" para `out_of_radius`.
- Estado vazio mais útil: sugestão de aumentar raio, ativar cidade ou cadastrar mais figurinhas/repetidas.

## 5) Reuso no `/home` e no scanner de notificações

- `_app.home.tsx`: usar a mesma `match_collectors` com fallback (sem exigir localização).
- `scan_match_alerts()`: atualizar para usar a nova fórmula e respeitar fallback por cidade (alertar quem não tem geo mas tem cidade + matches fortes).

## 6) Telemetria leve (opcional, sem nova tabela)

Adicionar `RAISE LOG` simples em `match_collectors` quando 0 resultados, para debug futuro via `postgres_logs`.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — nova versão de `match_collectors`, índices, ajuste em `scan_match_alerts`.
- `src/routes/_app.near.tsx` — filtros, badges, fallback sem localização, ordenação.
- `src/routes/_app.home.tsx` — usar fallback do match.
- `src/integrations/supabase/types.ts` — atualizado automaticamente após migração.

## Fora de escopo

- Push notifications nativas, e-mail, paginação > 100, machine learning de recomendação, mapa interativo real.
