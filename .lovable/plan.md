## OCR para nome de jogador + edição admin

### 1. Schema
Adicionar colunas em `stickers`:
- `player_name text` — nome do jogador extraído do OCR (editável)
- `player_name_source text` — `'ocr' | 'manual' | null` para sabermos o que foi auto-preenchido vs corrigido à mão
- `ocr_confidence numeric` — opcional, score retornado pelo modelo (0–1)
- `ocr_processed_at timestamptz` — última vez que o OCR rodou nesta figurinha

Índice `idx_stickers_player_name` (gin/trgm) para busca por nome.

### 2. OCR em lote (edge function `ocr-stickers`)
- Aceita `{ codes?: string[], only_kind?: 'player', only_missing?: boolean, limit?: number }` (default: roda em todas com `kind='player'` que ainda não têm `player_name`).
- Para cada figurinha:
  - Baixa `image_url`, manda para **Lovable AI** (`google/gemini-3-flash-preview`, multimodal) com prompt curto pedindo apenas o nome do jogador como string JSON: `{ "player_name": "...", "confidence": 0..1 }`. Se não conseguir ler, retorna `null`.
  - Atualiza `stickers.player_name`, `player_name_source='ocr'`, `ocr_confidence`, `ocr_processed_at`.
- Processa em chunks (ex. 10 paralelos) com pequeno delay para não estourar rate limit. Retorna sumário `{ total, ok, failed, skipped }`.
- `verify_jwt = true` + checagem `has_role(admin)` no início; só admin pode disparar.

### 3. Admin UI (`/_app/admin/stickers`)
- **Cabeçalho do card**: passa a mostrar `code · player_name` (ou "—" se vazio) acima de `flag + país`. Posição/tipo descem para a 2ª linha pequena.
- **Filtros**: novo input "Buscar (código, país ou jogador)" — busca também em `player_name`. Filtros existentes (país, sem imagem) mantidos. Adiciono toggle "Só sem nome (OCR)".
- **Botão "Rodar OCR"** no topo (só visível p/ admin): dropdown com 2 ações:
  - "OCR nas faltantes" → chama edge fn com `only_missing: true`
  - "OCR em todas (player)" → confirmação, roda em todas
  Mostra progresso via toast com contador.
- **Botão "OCR esta figurinha"** dentro do modal de edição: roda OCR só dessa.
- **Modal de edição**: novo campo `Nome do jogador` (text input) — salva em `player_name` e marca `player_name_source='manual'` quando alterado manualmente. Badge mostra "OCR" ou "Manual".
- Mantém troca de imagem e demais campos como hoje.

### 4. Atualização do tipo `Row` no admin
Inclui `player_name`, `player_name_source`, `ocr_confidence` no `select`/tipo.

### Fora do escopo
- Não altero a tabela `user_stickers` nem a UI do álbum/troca.
- Não mudo o catálogo (capa, FWC, CC) — OCR roda só em `kind='player'` por padrão; admin pode rodar em códigos específicos se quiser.
- Sem novas RLS além do que já existe (admin já tem update via política existente).

### Arquivos
- `supabase/migrations/<novo>.sql` — colunas + índice
- `supabase/functions/ocr-stickers/index.ts` (novo)
- `supabase/config.toml` — bloco da função
- `src/routes/_app.admin.stickers.tsx` — filtros, coluna nome, botões OCR, campo no modal

Aprovar?