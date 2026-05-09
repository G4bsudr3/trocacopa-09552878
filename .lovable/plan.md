## Diagnóstico

**Estado atual do banco** (`stickers`):
- 960 figurinhas cadastradas: 752 player + 112 special + 48 crest + 48 team
- 415 já têm `player_name` vindo do checklist; 545 ainda sem nome
- 885 com imagem; 75 sem imagem
- Faltam ~20 cards para chegar nas 980 (provavelmente parte da seção `Fifa World Cup History` / FWC)

**Por que a edge function falhou:**
A função `import-checklist` faz tudo numa única requisição síncrona — raspa as 50 páginas + baixa/upload de até 980 imagens + 980 upserts. Isso ultrapassa o tempo máximo (~150s wall-clock) do worker e estoura no meio. Além disso, a cada chamada ela tenta reprocessar tudo (não pula o que já está completo), então re-baixa imagens já enviadas.

## Plano

### 1) Tornar a importação **resumível e idempotente** (sem reimportar)

Editar `supabase/functions/import-checklist/index.ts`:

- **Default = pular o que já está pronto.** Um item é considerado "pronto" quando `player_name_source = 'checklist'` E `image_url IS NOT NULL`. Esses são removidos de `targets` antes do loop.
- **Novo parâmetro `limit`** (default 200): processa só esse lote por chamada. Resposta inclui `remaining` para o cliente saber quantas faltam.
- **Novo parâmetro `force`** (default false): quando true, ignora o filtro de "já pronto" (uso manual para reprocessar).
- **Cache do scrape**: se um item-alvo só precisa de imagem e já temos a `seq` no banco, não precisa raspar de novo. Mas como o scrape é barato (~6s para todas as equipes), mantemos o scrape completo e cortamos no download de imagem.
- **Pular imagem já existente**: antes de baixar, checa `existingMap[code].image_url` — se existir e `force=false`, não rebaixa.
- **Retorno enriquecido**: `{ processed, skipped_done, remaining, inserted, updated, image_ok, image_failed, errors[] }`.

### 2) Loop automático no admin até completar

Em `src/routes/_app.admin.stickers.tsx`, no botão **"Importar 980"**:

- Chama a edge function repetidamente em loop com `limit: 150` enquanto `remaining > 0`.
- Mostra um toast de progresso: `"Importando… 450/980 (lote 3)"`.
- Para no primeiro erro fatal ou quando `remaining === 0`.
- Botão extra **"Reimportar tudo (force)"** dentro de um menu, separado, para usar só se quisermos reprocessar.

### 3) Validar e completar dados faltantes

- Após o loop, rodar uma query de validação no cliente e mostrar um banner com os gaps:
  - Sem `player_name`
  - Sem `image_url`
  - `country_code` inconsistente (não bate com prefixo do `code`)
- Adicionar uma migration para garantir índice e integridade:
  - `CREATE UNIQUE INDEX IF NOT EXISTS stickers_code_key ON stickers(code)` (se ainda não existir como PK)
  - `CREATE INDEX IF NOT EXISTS stickers_country_kind_idx ON stickers(country_code, kind)`
  - `CREATE INDEX IF NOT EXISTS stickers_player_name_trgm ON stickers USING gin (player_name gin_trgm_ops)` (busca por nome rápida — extensão `pg_trgm` já está ativa)

### 4) Filtros completos no admin

Atualizar o painel `/admin/stickers` para permitir filtrar por **tudo** que existe no backend:

- Busca textual (`code`, `player_name`, `country_name`) — já existe, manter
- País (select) — já existe, manter
- **Tipo** (`kind`: player / crest / team / special / history) — novo select
- **Grupo** (A–L) — novo select
- **Origem do nome** (`player_name_source`: checklist / ocr / manual / vazio) — novo select
- **Status**: "Sem nome", "Sem imagem", "Completo" — substitui o checkbox atual "só sem nome"
- Contador no header continua mostrando `filtrados / total`.
- Ordenação por `position` (sequência oficial) como default, com toggle para ordenar por `code`.

### 5) Validação visível ao usuário

Pequeno painel "Saúde do catálogo" no topo do admin:

```
Total: 980 / 980    Com nome: 980    Com imagem: 980    Inconsistências: 0
```

Em vermelho quando algum número não bate com o esperado, com link "Ver" que aplica o filtro correspondente.

## Arquivos afetados

- `supabase/functions/import-checklist/index.ts` — resumível + `limit` + skip-if-done
- `src/routes/_app.admin.stickers.tsx` — loop automático, filtros novos, painel de saúde
- `supabase/migrations/<novo>.sql` — índices de busca/filtro

## Fora do escopo

- Não tocar em `user_stickers`, trocas, álbum
- Não recriar imagens já enviadas (a menos que `force=true`)
- Não criar página pública nova — só melhorar o `/admin/stickers`
