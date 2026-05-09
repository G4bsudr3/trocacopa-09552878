## Importar TODAS as 980 figurinhas + imagens do Central da Copa

Substitui o catálogo atual (864 incompleto) pelo oficial completo de 980 figurinhas (912 normais + 68 especiais), com nome do jogador, time, grupo, posição e imagem oficial.

### Como o site expõe os dados (descoberto via scraping)
- HTML SSR contém `code`, `player/title`, `team`, `group`, `position`, `rarity`.
- Filtro `?team=<Nome>` retorna ~20 cards por país (~50 chamadas cobrem tudo).
- Imagens: `https://firebasestorage.googleapis.com/v0/b/centralcopa-prod.firebasestorage.app/o/public%2Fstickers%2FWC2026_BR%2F{N}.jpg?alt=media` onde `N` = coluna `#` da tabela (1..980 base).
- Códigos batem 1:1 com o nosso schema (`MEX10`, `BRA15`, `FWC9`, ...).

### 1. Edge function `import-checklist` (admin-only)
`supabase/functions/import-checklist/index.ts`:
- `verify_jwt = true` + check `has_role('admin')`.
- Lista de times codificada (extraída do `<select>` do site, incluindo "FIFA World Cup 2026" e "Fifa World Cup History").
- Para cada time, faz `fetch` em `centraldacopa.app/checklist/world-cup-2026?team=<name>`, parseia `<table>`, extrai `seq`, `code`, `player_name`, `team`, `group_letter`, `position`, `rarity`, `kind` (TEAM/SPECIAL/GK/DEF/MID/FWD).
- Para cada figurinha:
  - Baixa imagem do Firebase (`WC2026_BR/{seq}.jpg`).
  - Re-upload no nosso bucket `sticker-images` em `{code}.jpg` (`upsert: true`).
  - **Upsert** em `public.stickers` por `code` (cria se não existir, atualiza se existir):
    - `player_name`, `player_name_source = 'checklist'`
    - `image_url` (URL do nosso bucket + cache-bust)
    - `country_code`, `country_name`, `group_letter`, `flag_emoji`, `position` (numérico = `seq`), `kind`
- Chunks de 5 paralelos com 200ms entre chunks. Total estimado ~2-3min para 980 itens.
- Retorna `{ total_scraped, inserted, updated, image_failed, errors[] }`.

Body opcional: `{ skip_images?: boolean, only_codes?: string[] }` para reruns rápidos.

### 2. Mapeamento `kind`
- `SPECIAL` (FWC0..8) → `kind = 'special'`
- `TEAM` em "Fifa World Cup History" (FWC9..19) → `kind = 'history'`
- `TEAM` por país (escudo/foto oficial) → `kind = 'crest'`
- `GK/DEF/MID/FWD` → `kind = 'player'` (com `position` interpretada via novo campo opcional ou ignorada)

### 3. Catálogo subirá para 980
- Hoje: 864 (47 crest + 47 team + 658 player + 112 special).
- Depois: 980 (48 escudos + 48 fotos oficiais + ~864 jogadores + 20 FWC).
- Items que ficarem em `stickers` mas não vierem da fonte (nenhum esperado, mas se houver) **não são deletados** — só logados em `errors` para revisão manual.

### 4. UI admin (`/_app/admin/stickers`)
- Botão **"Importar do Central da Copa"** ao lado do "Rodar OCR" — dropdown:
  - "Importar tudo (nome + imagem)" → roda completo
  - "Só nomes faltantes" → reusa só onde `player_name is null`, `skip_images: true`
- Toast com resumo (`X criados, Y atualizados, Z falhas de imagem`).
- Badge no card mostra origem: `Checklist` / `OCR` / `Manual`.

### 5. Fora do escopo
- Não importo as 94 variantes extras (epic/legendary/rare alternativos) — só as 980 oficiais.
- Não mexo em `user_stickers`, álbum ou trocas.
- Sem migração de schema (`player_name_source` é text livre).

### Detalhes técnicos
- Edge function Deno, `fetch` direto (site é público, sem auth).
- Parser: regex `<tr>...<td>...</td>...</tr>` com decode de entidades HTML (`&aacute;`, `&#x...`, etc).
- Storage: bucket `sticker-images` já existe e é público.
- Idempotente: roda quantas vezes precisar.
- Falha individual em try/catch — não derruba o lote.

### Arquivos
- `supabase/functions/import-checklist/index.ts` (novo)
- `supabase/config.toml` (registro da função se necessário)
- `src/routes/_app.admin.stickers.tsx` (botão + handler + badge "Checklist")

Aprovar pra eu implementar?
