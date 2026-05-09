## Objetivo

Garantir que **todas** as figurinhas do álbum oficial estejam mapeadas com a imagem certa, usando o PDF como fonte da verdade, e dar a você uma tela admin para corrigir qualquer mapeamento errado.

---

## 1. Reconstrução do catálogo (verdade = PDF)

O PDF tem 54 páginas, e cada página segue uma estrutura fixa:

```
célula 0 (canto sup. esq.)  →  brasão da seleção (posição 1)
células 1..15               →  jogadores (posições 2..16)
```

- **48 páginas** = 48 seleções (16 figurinhas cada → 768 stickers)
- **6 páginas restantes** = especiais (mascote, troféu, estádios, lendas, etc. → ~96 stickers)

Total real: **~864 figurinhas**, não 994 como está hoje.

Ações:
- Apagar `stickers` e re-popular a partir do PDF de forma determinística.
- Códigos novos no padrão `{COD}1..{COD}16`: `1` = brasão, `2..16` = jogadores. Ex.: `GER1` (brasão Alemanha), `GER2` (Baku), `GER3` (Gnabry)…
- Página de cover/specials/legends recebe códigos `SP1..SPn`, `LEG1..LEGn` (decidido pela ordem real do PDF).
- Limpar `user_stickers` (catálogo antigo deixou de existir; vamos resetar coleções — ainda em fase beta).

## 2. Mapeamento determinístico das imagens

- Já temos 864 cells extraídos em `/tmp/cells/pageNN_rXcY.jpg`.
- Mapear cada célula para o `code` correspondente pela posição na página (sem IA, 100% determinístico).
- Identificar, **por página**, qual seleção é (1 chamada Gemini por página passando só o brasão da célula 0 → retorna `country_code`). Páginas que não baterem com nenhuma seleção viram "specials".
- Subir cada imagem ao bucket `sticker-images` como `{code}.jpg` e gravar `image_url` em `stickers`.

## 3. Tela de Admin

### Backend
- Migration:
  - `CREATE TYPE app_role AS ENUM ('admin','user')`
  - Tabela `user_roles(user_id, role, UNIQUE)` + RLS + função `has_role(uid, role)` security definer.
  - Atualizar policy de `stickers` para permitir `UPDATE` por admins (via `has_role`).
  - Storage policy: admin pode `INSERT/UPDATE/DELETE` em `sticker-images`.
- Inserir você como admin (você me passa seu email/user_id após confirmar).

### Frontend (`/admin/stickers`)
- Rota protegida via `_admin` layout que checa `has_role(uid,'admin')`; usuários comuns são redirecionados.
- Lista todas as figurinhas com:
  - thumbnail atual, código, país, posição, tipo (brasão/jogador/special)
  - filtros: por país, por tipo, "sem imagem", "imagem suspeita"
  - busca por código ou nome
- Ações por linha:
  - **Trocar imagem** (upload manual → bucket → atualiza `image_url`)
  - **Editar metadados** (`country_name`, `kind`, `position`, `flag_emoji`, `code`)
  - **Excluir figurinha** (caso o catálogo ainda tenha lixo)
- Ação em massa: "reordenar página" (arrastar para corrigir ordem das células de uma página inteira).

## 4. Limpeza no app

- Remover dependência de `position` fixa de 1..20; usar a contagem real do banco para "X/Y completo".
- `_app.album.tsx`, `_app.scan.tsx`, `_app.trade.$id.tsx` continuam funcionando (já usam `image_url`).

---

## Detalhes técnicos

- Identificação de país por página: prompt enviando só o brasão (cell 0) + lista das 48 seleções → resposta JSON `{country_code}`. Mais barato e mais preciso que mandar 16 figurinhas juntas.
- Reordenação no admin: drag-and-drop atualiza o campo `position` em batch.
- Upload via admin usa `supabase.storage.from('sticker-images').upload(..., { upsert: true })`.
- Restrição admin: `<lov-open-backend>` continua disponível para inspeção direta no DB.

## Fora de escopo

- Reconhecimento OCR durante o scan continua igual (já funciona).
- Edição de stickers por usuários comuns.
- Versionamento/histórico das alterações.

## Pergunta pendente

Para te marcar como admin preciso do **email da sua conta** no app (ou seu `user_id`). Posso seguir e te peço logo no início da implementação.
