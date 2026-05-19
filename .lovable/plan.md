## Exportar listas de figurinhas (faltam / repetidas)

Adicionar uma seção "Exportar listas" na página **Meu Álbum** (`src/routes/_app.album.tsx`) com dois botões principais:

- **Faltam** — gera a lista de figurinhas que o usuário ainda não tem
- **Repetidas** — gera a lista de figurinhas com `duplicates > 1` (quantidade trocável = duplicates − 1)

Cada botão abre um pequeno menu (dropdown) com 3 formatos: **CSV**, **TXT** e **PDF**.

### Conteúdo dos arquivos

Organizado por **GRUPO A..L**, na ordem oficial do álbum (já definida em `COUNTRY_ORDER_LIST`). Para cada país: nome + bandeira, seguido das figurinhas (código, posição, nome do jogador quando houver). Nas repetidas, mostrar também a quantidade trocável.

Exemplo (TXT):
```
TrocaCopa — Figurinhas que faltam (João, 12/05/2026)
Total: 415 de 980

GRUPO A
México (4 faltando)
  MEX3  — Edson Álvarez
  MEX7  — Santiago Giménez
  ...
```

PDF segue o mesmo layout, com cabeçalho, contagem por grupo e quebra de página entre grupos quando necessário.

### Implementação técnica

1. Novo módulo `src/lib/export-stickers.ts` com helpers puros:
   - `buildMissingList(stickers)` e `buildDuplicatesList(stickers)` — retornam estrutura `{ group, countries: [{ name, flag, items: [...] }] }` usando a ordenação já existente em `groupByCountry`.
   - `toCSV(data, kind)`, `toTXT(data, kind)` — geram string.
   - `toPDF(data, kind, meta)` — usa `jspdf` para gerar Blob.
2. Helper `downloadBlob(filename, blob)` aciona download no navegador.
3. Nova seção "Exportar listas" no topo do `_app.album.tsx` (acima dos filtros), usando os componentes shadcn `DropdownMenu` + `Button` já presentes. Nomes de arquivo: `trocacopa-faltam-AAAA-MM-DD.csv`, etc.
4. Dependência nova: `jspdf` (pura JS, funciona no browser). Instalada via `bun add jspdf`.

### Fora do escopo

- Sem alterações de backend, RLS, schema ou Supabase.
- Sem mudança na página de Repetidas além do botão (se desejar, posso replicar lá também — confirmar).
- Sem envio por e-mail / compartilhamento nativo nesta etapa.
