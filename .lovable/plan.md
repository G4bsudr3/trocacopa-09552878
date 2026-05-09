## Objetivo

Importar o PDF oficial Panini (54 páginas, ~864 figurinhas em grid 4×4) e exibir a foto real de cada figurinha sempre que o usuário a possuir (via scan ou ID), com um preview "oculto/blur" quando ainda não tiver.

## Etapas

### 1. Extração das imagens (script único, offline)
- Renderizar cada página do PDF a 200 DPI com `pdftoppm`.
- Cortar cada página em 16 células (grid 4×4) → ~864 JPGs individuais.
- Para cada célula, usar Lovable AI (`google/gemini-2.5-flash`) com a foto da figurinha e o catálogo de códigos existente em `stickers` (994 entradas) para identificar o `code` exato (ex.: `GER3`, `ARG1`, `COV`, `FWC7`).
- Salvar mapeamento `code → arquivo` em `/tmp/mapping.json` para revisão.

### 2. Storage
- Criar bucket público `sticker-images` (cache longo).
- Subir cada JPG como `{code}.jpg`.
- Adicionar coluna `image_url text` em `public.stickers` e popular com a URL pública.

### 3. UI — exibir foto real
Locais que passam a usar `sticker.image_url`:
- **Álbum** (`_app.album.tsx`): miniatura colorida quando possuída, miniatura com blur + cadeado quando faltante.
- **Scan** (`_app.scan.tsx`): após reconhecer, mostrar a foto oficial ao lado do "Você ganhou" / "Duplicada".
- **Troca** (`_app.trade.$id.tsx`) e **Near** (cards de match): thumbs reais das figurinhas ofertadas/pedidas.
- Componente novo `StickerThumb` com props `code`, `owned`, `size` para reuso.

### 4. Estilo do "preview oculto"
- Quando `!owned`: `<img>` com `filter: blur(8px) grayscale(1)` + overlay escura + ícone de cadeado e o código.
- Quando `owned`: imagem nítida com leve sombra/borda dourada para duplicatas.

## Detalhes técnicos

- Edge function não é necessária para extração — roda via `code--exec` no agente.
- O bucket `sticker-images` terá policy SELECT pública; INSERT só via service role (pelo agente).
- Migração: `ALTER TABLE stickers ADD COLUMN image_url text;` + `UPDATE stickers SET image_url = ...`.
- A função `scan-sticker` continua igual (Gemini retorna `code`); o front passa a renderizar `image_url` correspondente.
- Tamanho estimado total: ~25 MB (864 JPGs ~30 KB cada após resize 300×400).

## Fora de escopo
- Reprocessar o PDF dentro da app em runtime (faremos uma vez só).
- Mudar a lógica de OCR/scan já existente.
- Imagens animadas/holográficas para legendárias.
