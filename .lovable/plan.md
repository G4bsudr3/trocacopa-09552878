## 1) Scan da página do álbum — precisão real

Hoje `AlbumPageScanner` usa **Tesseract no cliente** (`src/lib/scan-ocr.ts`) que mal lê os códigos impressos; quase nunca acerta a lista "faltando". A edge function `scan-album-page` (Gemini 2.5 Pro com prompt slot-a-slot já existe) está disponível mas não é chamada.

Mudanças:
- `src/lib/scan-ocr.ts`: trocar Tesseract por chamada à edge function `scan-album-page` (multimodal). Manter a mesma assinatura `ocrAlbumPage(dataUrl, catalog)` para não mexer no scanner UI.
- `supabase/functions/scan-album-page/index.ts`: endurecer o prompt para forçar análise grid-por-grid:
  - exigir leitura de TODOS os slots da grade (4×5 / 4×4 / página especial), retornando `filled` ou `empty` para cada um.
  - usar regras claras: "filled = foto de jogador/escudo colada sobre o código impresso; empty = código impresso visível em fundo liso".
  - filtrar saída por código que existe no catálogo, deduplicar.
  - adicionar pós-processamento: se ≥3 slots reconhecidos pertencem a um país, completar a grade do país (1..N) e marcar como `empty` o que não foi visto como `filled`. Isso resolve "não reconhece as que faltam".
- `album-page-scanner.tsx`: passar dataUrl reduzido (max 1600px lado maior) antes do upload e mostrar progresso indeterminado.

Resultado: tirar foto da página → IA devolve todos os slots, app cruza com a coleção do usuário e mostra preciso "tem / não tem / faltando".

## 2) Scan de figurinha individual — mais preciso

Em `supabase/functions/scan-sticker/index.ts`:
- Trocar modelo de `gemini-2.5-flash` para `gemini-2.5-pro` (mais acerto no nome/código).
- Forçar `response_format: { type: "json_object" }` (hoje aceita texto solto e faz `replace ``` `).
- Reforçar prompt: pedir o código impresso EXATO (canto superior/inferior), o nome do jogador como aparece, escudo do país, número da camisa.
- Adicionar 2ª passada quando `confidence < 0.6` e nada bateu no catálogo: enviar a mesma imagem com um prompt curto "What is the printed sticker code (e.g. BRA10, FWC1)?" e tentar resolver pelo código.
- Resolução: depois de match por código/jogador, devolver sempre `suggestions` (top 3) para o usuário escolher manualmente quando confiança for média.

Em `src/routes/_app.scan.tsx`:
- Pré-processar a imagem antes de mandar: cortar para um quadrado central, escalar para 1024px, JPEG 0.9. Reduz ruído de fundo (mesa, mão, etc).
- Mostrar as `suggestions` numa lista clicável quando a IA não tiver certeza.

## 3) Preview de match no plano grátis + contato livre no Pro

Hoje qualquer usuário inicia troca com qualquer pessoa em `/near`. Vamos gatear o contato no plano grátis e abrir para Pro.

Regra:
- **Grátis**: só pode iniciar troca/conversa com quem tem `mutual_count >= 1` (troca 1-1 real). Para os outros, mostrar **prévia**: lista das figurinhas que **eles têm pra você** (até 5 códigos com bandeira/nome) e CTA "Faça match adicionando essas figurinhas" + "Desbloqueie todos com Pro".
- **Pro** (`profile.plan === 'pro'`): vê **todos** os códigos compartilhados (give/receive completos) e pode iniciar troca com qualquer um, mesmo sem match 1-1.

Mudanças:
- Nova função RPC `public.match_preview_stickers(_other uuid, _limit int)` (SECURITY DEFINER, mesma regra de idade do `match_collectors`) que retorna até N códigos que o outro tem e o usuário precisa, e até N códigos que o usuário oferece e o outro precisa.
- `src/routes/_app.near.tsx`:
  - Card de cada colecionador ganha seção expansível "Ver figurinhas em comum" que chama `match_preview_stickers` sob demanda; limite = 5 no grátis, 50 no Pro.
  - Botão "Iniciar Troca" fica habilitado se `mutual_count >= 1` ou `plan === 'pro'`. Caso contrário vira "Bloqueado — faça match (ou seja Pro)" com link para `/pro`.
- `src/routes/_app.pro.tsx`: atualizar a tabela de features:
  - "Ver figurinhas em comum" → grátis "Prévia (5)", Pro "Todas".
  - "Falar sem match 1-1" → grátis ✗, Pro ✓.

Sem mexer em RLS de `user_stickers` (privacidade preservada — a RPC só devolve códigos pertencentes a stickers que o solicitante precisa, sem revelar quantidade nem o resto da coleção).

## Arquivos afetados
- `supabase/functions/scan-album-page/index.ts`
- `supabase/functions/scan-sticker/index.ts`
- `src/lib/scan-ocr.ts`
- `src/components/album-page-scanner.tsx`
- `src/routes/_app.scan.tsx`
- `src/routes/_app.near.tsx`
- `src/routes/_app.pro.tsx`
- nova migração SQL com a função `match_preview_stickers`