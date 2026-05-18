## Objetivo

A ordenação dos países dentro de cada grupo (México, África do Sul, Coreia do Sul, Rep. Tcheca etc.) já foi aplicada na turn anterior em `src/lib/stickers.ts` via `groupByCountry()` — os países hoje aparecem na ordem correta do álbum.

O que ainda falta para "ficar mais fácil" como você pediu é a **separação visual por grupo**: hoje a página `/album` lista os 48 países em sequência, sem cabeçalho de grupo, então fica difícil enxergar o bloco "GRUPO A → México, RSA, KOR, CZE".

## Plano

### 1. Adicionar cabeçalho "GRUPO X" no álbum
Em `src/routes/_app.album.tsx` (aba **Seleções**):
- Antes de renderizar a lista `groupedCountries`, agrupar os países por `group_letter` mantendo a ordem já correta.
- Renderizar para cada grupo:
  - Um cabeçalho fino com `GRUPO A`, `GRUPO B`, ... (font-display, com a contagem `x/16` de figurinhas do grupo coletadas).
  - Os 4 cards de país do grupo logo abaixo (sem mudar o card em si).
- Aplicar o mesmo agrupamento na aba quando o filtro estiver em "Tenho/Faltam/Repetidas" — os cabeçalhos seguem aparecendo, e grupos vazios após filtro são ocultados.

### 2. Aplicar mesmo agrupamento na página de repetidas
Em `src/routes/_app.duplicates.tsx`, que também usa `groupByCountry`, adicionar os mesmos cabeçalhos "GRUPO X" para manter consistência.

### 3. Sem mudanças em dados / backend
- Nada muda em SQL, RLS ou edge functions.
- A ordem já está garantida em `src/lib/stickers.ts` (`COUNTRY_ORDER_LIST`).

## Arquivos afetados
- `src/routes/_app.album.tsx` — adicionar agrupamento por `group_letter` com cabeçalho.
- `src/routes/_app.duplicates.tsx` — idem.

## Pergunta antes de implementar
Confirma que é isso que você quer (adicionar os cabeçalhos "GRUPO A..L" separando os 4 países de cada grupo no álbum e na tela de repetidas)? Ou existe outra tela específica onde a ordem ainda está errada — se for o caso, me diga qual.