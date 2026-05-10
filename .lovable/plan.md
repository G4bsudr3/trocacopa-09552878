## Sim, é viável

Já temos o padrão de visão do Lovable AI (Gemini) rodando em edge function (`ocr-stickers`). Vamos criar um fluxo análogo, mas para uma **página inteira do álbum**: o usuário tira uma foto, o modelo identifica os códigos visíveis (ex.: BRA1, ARG10, FWC1) e marca quais estão colados vs. vazios. Depois pré-confirmamos o que vai entrar no álbum.

## Fluxo do usuário
1. Em **/scan**, novo botão "Escanear página do álbum" abre câmera/upload.
2. Foto vai para Storage (`contributions` ou novo bucket privado `album-pages`).
3. Edge function `scan-album-page` chama Gemini Vision com a imagem + a lista de códigos do catálogo (passada como contexto) e devolve:
   - `present`: códigos que aparecem **colados** na página
   - `missing`: códigos da página que aparecem **vazios**
   - `unknown_slots`: posições onde o modelo não conseguiu decidir
4. Tela mostra um resumo: "Detectei 18 figurinhas — 12 já tem, 6 são novas. Confirmar?"
   - Cada item com checkbox (pré-marcado conforme a IA) e mini-foto recortada quando possível.
5. Ao confirmar, faz upsert em `user_stickers` (insere as novas, não mexe nas existentes; sem duplicar).

## Backend
- Nova edge function `supabase/functions/scan-album-page/index.ts`:
  - Auth obrigatória (qualquer usuário, não só admin).
  - Input: `{ image_url }` (URL pública assinada do Storage) ou `{ image_base64 }`.
  - Prompt para Gemini: "Esta é uma página de álbum Panini-style. Para cada slot, retorne `{code, status: 'filled'|'empty'|'unknown'}`. Use APENAS códigos desta lista: [...]". A lista do catálogo é carregada do `stickers` no início.
  - Resposta JSON estruturada via `response_format`.
  - Retorna `{ present: string[], missing: string[], unknown: string[] }`.

## Frontend
- Em `src/routes/_app.scan.tsx`, adicionar segunda aba/botão **"Página inteira"** ao lado do scan unitário.
- Componente novo `AlbumPageScanner` que: tira/seleciona foto → upload no Storage → chama a edge function → mostra modal de revisão com toggles → grava em `user_stickers`.

## Storage
- Reutilizar bucket `contributions` (já existe e é privado por usuário) com prefixo `album-pages/{user_id}/...`. Sem novo bucket nem migração de schema.

## Limites e custo
- 1 chamada Gemini por foto. Sugiro limitar a 10 fotos/dia por usuário no Free (rate-limit simples na função, opcional). Posso deixar sem limite no MVP — você decide depois.
- Precisão depende da foto (ângulo, brilho). Por isso pré-confirmamos antes de gravar.

## Fora do escopo
- Não vamos escrever em `stickers` (catálogo) nem alterar OCR de figurinha individual.
- Sem detecção de duplicatas/qualidade da colagem nesta versão.
- Sem painel admin para revisar contribuições de página.
