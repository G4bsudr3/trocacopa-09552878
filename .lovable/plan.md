## Objetivo
Substituir o ranking simples de `nearby_collectors` por um **motor de Match** que combina três sinais — **localização (cidade/região + distância)**, **disponibilidade de repetidas que eu preciso** e **compatibilidade do álbum** (o quanto faz sentido trocar dos dois lados) — produzindo um score interpretável e ordenado para os melhores colecionadores.

## Diagnóstico do estado atual
A função atual `nearby_collectors`:
- Conta `match_count` (repetidas dele que eu preciso) considerando apenas `duplicates >= 1`, o que é incorreto: a figurinha colada também conta como `duplicates = 1`. O correto é `duplicates >= 2` para "tem repetida disponível para trocar".
- Não usa `city` nem região; usa só haversine.
- Score atual mistura tudo num único número e ordena por matches absolutos (após o último ajuste) sem considerar quão "completo" é o match relativo ao meu álbum.
- Não expõe os componentes do score na UI — usuário não sabe por que um match é bom.

## Plano

### 1. Nova função `match_collectors(_radius_km, _limit)` (migration)
Substitui o uso anterior. Mantém `nearby_collectors` por compatibilidade, mas a UI passa a chamar a nova.

Calcula, para cada outro colecionador descobrível com localização:

- `give_count` — figurinhas que **ele tem como repetida** (`duplicates >= 2`) **e eu não tenho** (`user_stickers` ausente OU `duplicates = 0`). Esse é o "ele tem pra mim".
- `receive_count` — figurinhas que **eu tenho como repetida** (`duplicates >= 2`) **e ele não tem**. Esse é o "eu ofereço".
- `mutual_count` = `LEAST(give_count, receive_count)` — trocas 1-pra-1 viáveis hoje.
- `distance_km` — haversine.
- `same_city` = `lower(unaccent(o.city)) = lower(unaccent(my.city))` quando ambos têm cidade.
- `region_bonus` — `1.0` mesma cidade, `0.5` distância ≤ 25 km, `0` caso contrário.
- `proximity_score` = `GREATEST(0, 1 - distance_km / radius)`.
- `album_compat` = `mutual_count / GREATEST(my_missing, 1)` clampado em [0,1] — quanto do meu álbum esse colecionador pode fechar diretamente.
- `score` (0–100):
  ```text
  0.45 * tanh(mutual_count / 10)        -- viabilidade real de troca
+ 0.20 * tanh(give_count   / 15)        -- ele tem o que falta
+ 0.10 * tanh(receive_count / 15)       -- eu tenho o que falta
+ 0.15 * proximity_score
+ 0.10 * region_bonus
  ```
  multiplicado por 100 e arredondado.
- Ordenação:
  ```text
  ORDER BY score DESC, mutual_count DESC, distance_km ASC
  ```
- Filtra apenas quem tem `mutual_count >= 1` OU está dentro do raio (para não devolver perfis irrelevantes).

Retorna todas as colunas atuais + `give_count`, `receive_count`, `mutual_count`, `same_city`, `region_bonus`, `score_pct`.

Permissões: `SECURITY DEFINER`, `STABLE`, `search_path = public`, `REVOKE EXECUTE FROM anon`, `GRANT EXECUTE TO authenticated` — alinha com os warnings de linter já existentes.

### 2. Frontend — `src/routes/_app.near.tsx`
- Trocar `supabase.rpc("nearby_collectors", …)` por `supabase.rpc("match_collectors", { _radius_km: radius })`.
- Atualizar o tipo `NearbyRow` com os campos novos.
- Substituir o card de match para mostrar:
  - **Score** grande (0–100) no canto direito (substitui `compatPct`).
  - Linha de breakdown com 3 chips: "Trocas 1-1: N", "Tem pra você: G", "Você oferece: R".
  - Badge "Mesma cidade" quando `same_city`, senão badge "Perto" quando `distance_km < radius * 0.25`.
- Subtítulo passa a explicar: "Score = trocas viáveis + cidade + álbum".

### 3. Frontend — `src/routes/_app.home.tsx`
- Trocar a chamada do bloco "featured-nearby" para `match_collectors` com `_radius_km: 25`, mantendo `slice(0, 5)`.
- Exibir o `score_pct` em vez do `distance_km` cru no resumo do card (mantendo a cidade).

### 4. Documentação curta no card
Adicionar um `<p className="text-[10px] text-muted-foreground">` explicando "Calculado por trocas 1-pra-1 viáveis, repetidas dele/seu e proximidade". Sem tooltip extra para manter simples.

## Detalhes técnicos
- A função usa CTEs (`my_owned_dupes`, `my_needs`, `their_dupes`, `forward`, `reverse`) para manter complexidade O(N) por colecionador.
- `unaccent` requer a extensão; se não estiver presente já no schema `public`, o match por cidade cai para `lower(o.city) = lower(my.city)` — verificado durante a migration via `CREATE EXTENSION IF NOT EXISTS unaccent` (já no schema `extensions`/`public` conforme padrão do projeto). Se falhar, usa apenas `lower()`.
- `tanh` está disponível nativamente no Postgres (`tanh(double precision)`).

## Arquivos
- `supabase/migrations/<nova>.sql` — cria/replace `match_collectors`, grants, e (opcional) `CREATE EXTENSION IF NOT EXISTS unaccent`.
- `src/routes/_app.near.tsx` — chamada do RPC, tipos, UI do card.
- `src/routes/_app.home.tsx` — chamada do RPC e exibição do score.
- `src/integrations/supabase/types.ts` — regenerado automaticamente após a migration.

## Fora de escopo
- Filtros adicionais (apenas mesma cidade, apenas com mútuo > X).
- Cache server-side, paginação acima de 100.
- Notificações automáticas de novos matches.
- Mexer em `nearby_collectors` (deixa intacta para compatibilidade).
