## Objetivo

Polir o visual do "Meu Álbum" (cadeado central + overlay elegante) **e** garantir que TODAS as 980 figurinhas tenham imagem — incluindo as 104 jogadores que ainda caem no fallback de emoji.

## Parte 1 — Polir visual (`src/routes/_app.album.tsx`)

Hoje (linhas 391-410) a célula renderiza:
- imagem com `blur-[6px] grayscale opacity-60` quando não-owned
- ícone de cadeado pequeno na base

**Melhorias:**

- **Overlay escuro mais elegante:** trocar `bg-background/30` por `bg-gradient-to-t from-background/85 via-background/40 to-background/10`, dando profundidade.
- **Cadeado centralizado dentro de um círculo glass:** posicionar `Lock` em um círculo `w-9 h-9 rounded-full glass-strong` no centro vertical da célula, em vez de pequeno na base.
- **Blur mais sutil:** `blur-[4px] grayscale-[80%] opacity-70 scale-105` (continua "preview", mas dá pra reconhecer cores/forma).
- **Animação revelação:** quando o usuário marca como owned, a imagem desfaz o blur com `transition-all duration-500`.
- **Faixa do código no rodapé:** já existe (linha 421-425); manter, mas trocar para `bg-gradient-to-t from-background/95 to-transparent` e mostrar **código + emoji** (ex: "BRA10 🇧🇷").
- **Hover/long-press dica:** badge `?` no canto sup-esq quando não-owned, em `bg-muted text-muted-foreground`.
- **Mesmo tratamento na modal de detalhe** (linha 266) — manter blur só se não-owned, com transição.

## Parte 2 — Backfill das 104 figurinhas sem imagem

São jogadores de seleções não-cobertas pelo scrape original. Scrape externo é frágil; em vez disso, **gerar uma carta-placeholder polida** que se parece com a figurinha oficial e funciona como preview legítimo.

**Nova edge function `generate-sticker-images` (admin-only):**

1. Lê `stickers WHERE kind='player' AND image_url IS NULL`.
2. Para cada uma, monta um **SVG 600×800** com:
   - Fundo gradiente nas cores aproximadas da bandeira (paleta hard-coded por `country_code`).
   - Silhueta de jogador (path SVG simples, mesma para todos).
   - Bandeira emoji grande no canto sup-dir.
   - Nome do país no topo.
   - Número da camisa (`position % 20` ou índice dentro do país) grande no centro.
   - Código no rodapé (ex: "ALG10").
3. Converte SVG → PNG via `https://deno.land/x/resvg_wasm` (ou simplesmente faz upload do SVG, que o `<img>` renderiza nativamente).
4. Faz upload em `sticker-images/players/{code}.svg` no bucket público.
5. `UPDATE stickers SET image_url = '<public-url>' WHERE code = ...`.

Decisão pragmática: **fazer upload como SVG mesmo** — bucket já é público, navegadores renderizam SVG em `<img>` sem problema, e elimina a dependência de WASM. Tamanho ~3KB por figurinha.

**Botão "Gerar imagens faltantes"** em `src/routes/_app.admin.stickers.tsx` que invoca a função e mostra resultado (ok/falhas).

## Parte 3 — Cache de imagem no álbum

- Adicionar `<img loading="lazy" decoding="async" />` (já tem lazy) e `fetchPriority="low"` para itens não-owned, para priorizar as figurinhas que o usuário tem.

## Arquivos

- `src/routes/_app.album.tsx` — polish visual (célula + modal)
- `supabase/functions/generate-sticker-images/index.ts` (nova)
- `src/routes/_app.admin.stickers.tsx` — botão "Gerar imagens faltantes"

## Fora de escopo

- Não scrapear sites externos (frágil, varia por país).
- Não trocar o emoji da bandeira no resto do app.
