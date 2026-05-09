## Objetivo

Quando o usuário escaneia uma figurinha em `/scan`, o OCR deve extrair **nome do jogador**, **país** e (quando legível) **código**, e então **resolver automaticamente para o código correto** consultando o catálogo `stickers` (que já contém `player_name`, `country_name`, `country_code`, `position`, `kind`).

Hoje o `scan-sticker` só pede `code` e `country_name` — se o código está borrado ou cortado, falha. O catálogo já tem `player_name` populado pelo `ocr-stickers` em massa, então podemos fazer match reverso pelo nome.

## Mudanças

### 1. `supabase/functions/scan-sticker/index.ts` — prompt + resolução

**Novo prompt** (Gemini 2.5 Flash, multimodal) extrai 4 campos:

```json
{
  "code": "BRA10 | FWC5 | CC3 | null",
  "country_name": "Brasil | null",
  "player_name": "Vinícius Júnior | null",
  "jersey_number": 10 | null,
  "kind_hint": "player | history | sponsor | cover | null",
  "confidence": 0..1
}
```

Prompt enfatiza:
- Código fica no canto inferior (3 letras + 1-20, ou `FWC`/`CC` + número, ou `00`).
- Nome do jogador é o texto grande sob a foto.
- Bandeira/escudo indica país.
- Se for capa, FWC ou CC, `player_name` deve ser `null`.

**Resolução server-side** (nova função `resolveCode`) na ordem:

1. Se `code` veio e existe em `stickers` → usa.
2. Se `country_name` + `jersey_number` → busca `stickers` por `country_name ILIKE` (ou via `unaccent`) + `position = number` + `kind = 'player'`.
3. Se `player_name` → busca `stickers` por similaridade (`pg_trgm` `similarity()` >= 0.45) ordenado por score, opcionalmente filtrando por `country_name` se também veio.
4. Se nada bate, devolve `code: null` mas inclui `suggestions: [{code, player_name, country_name, score}]` (top 3) para a UI mostrar.

A função usa `SUPABASE_SERVICE_ROLE_KEY` para consultar `stickers` (já é leitura, mas evita bater em RLS de auth).

**Resposta nova:**
```json
{
  "code": "BRA10",
  "country_name": "Brasil",
  "player_name": "Vinícius Júnior",
  "confidence": 0.88,
  "match_source": "code | country+number | player_name | suggestion",
  "suggestions": [...]   // só quando code é null
}
```

### 2. `src/routes/_app.scan.tsx` — usar nome + sugestões

- Mensagem de sucesso passa a mostrar `${code} — ${player_name} ${flag_emoji}` quando disponível.
- Quando `code` é `null` mas `suggestions` tem itens, exibir um pequeno painel "Você quis dizer?" com até 3 cards clicáveis (jogador + país + código). Tocar adiciona via `confirmSelect(code)`.
- Mantém fallback atual (digitar manualmente) quando nem isso resolve.

### 3. Índice de busca por nome (migration leve)

Adicionar índice GIN trigram para acelerar o match:

```sql
CREATE INDEX IF NOT EXISTS idx_stickers_player_name_trgm
  ON public.stickers USING gin (lower(unaccent(coalesce(player_name,''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stickers_country_position
  ON public.stickers (lower(unaccent(country_name)), position) WHERE kind = 'player';
```

`pg_trgm` e `unaccent` já estão habilitados (visíveis nas funções existentes).

### 4. Garantir catálogo populado

O match por nome só funciona se `stickers.player_name` estiver preenchido. O admin job `ocr-stickers` já faz isso em massa a partir de `image_url`. Vou verificar pela tela `/admin/stickers` se ainda há figurinhas com `player_name = null` e, se houver, sugerir rodar o batch — mas isso é operação, não código.

## Arquivos

- `supabase/functions/scan-sticker/index.ts` (reescrita do prompt + resolução)
- `src/routes/_app.scan.tsx` (UI de sugestões + mensagem com nome)
- nova migration com 2 índices

## Fora de escopo

- Não mexo no `ocr-stickers` (batch admin) nem no fluxo `identify-page`.
- Não altero schema da tabela `stickers`.
