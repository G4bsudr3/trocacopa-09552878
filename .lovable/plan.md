## Objetivo

Trocar o catálogo genérico de 640 figurinhas numéricas por **994 figurinhas reais**, organizadas exatamente como o PDF do Ludopédio: 12 grupos (A–L) × 4 países × 20 cromos + capa "00" + 19 FWC (História) + 14 Coca-Cola.

## 1. Migração de schema

Hoje `stickers.number` é `integer` e `user_stickers.sticker_number` também. Os códigos reais são alfanuméricos (`MEX1`, `FWC7`, `CC3`, `00`). Migração:

- Adicionar colunas em `stickers`: `code text PK`, `country_code text`, `country_name text`, `position int`, `kind text` (`country` | `history` | `special` | `cover`), `flag_emoji text`.
- Migrar `user_stickers.sticker_number int → sticker_code text` (FK para `stickers.code`). Limpar dados antigos (catálogo está sendo trocado de qualquer forma).
- Mesma troca em `trades.offered_stickers` / `trades.requested_stickers` (array de `int` → array de `text`).
- Reescrever `nearby_collectors()` para usar `sticker_code text`.

## 2. Seed completo

Inserir os 994 cromos respeitando a tabela do PDF:

```text
Capa: 00 (kind=cover)
Grupo A: México MEX1–20, África do Sul RSA1–20, Coreia do Sul KOR1–20, Rep. Tcheca CZE1–20
Grupo B: Canadá CAN, Bósnia BIH, Catar QAT, Suíça SUI
Grupo C: Brasil BRA, Marrocos MAR, Haiti HAI, Escócia SCO
Grupo D: EUA USA, Paraguai PAR, Austrália AUS, Turquia TUR
Grupo E: Alemanha GER, Curaçao CUW, Costa do Marfim CIV, Equador ECU
Grupo F: Holanda NED, Japão JPN, Suécia SWE, Tunísia TUN
Grupo G: Bélgica BEL, Egito EGY, Irã IRN, Nova Zelândia NZL
Grupo H: Espanha ESP, Cabo Verde CPV, Arábia Saudita KSA, Uruguai URU
Grupo I: França FRA, Senegal SEN, Iraque IRQ, Noruega NOR
Grupo J: Argentina ARG, Argélia ALG, Áustria AUT, Jordânia JOR
Grupo K: Portugal POR, Congo COD, Uzbequistão UZB, Colômbia COL
Grupo L: Inglaterra ENG, Croácia CRO, Gana GHA, Panamá PAN
FIFA World Cup History: FWC1–FWC19 (kind=history)
Coca-Cola: CC1–CC14 (kind=special)
```

Total: 1 + 48×20 + 19 + 14 = **994**. Bandeiras como emoji por país para visual.

## 3. Refatorar `useAlbum` / catálogo

- `TOTAL_STICKERS = 994`.
- Tipos: `Sticker.code: string` (em vez de `number`). Métodos `toggleOwned(code)`, `addDuplicate(code)` etc. recebem string.
- Hook agrupa por `kind` e `country_code` para alimentar a tela.

## 4. Tela do Álbum no formato do PDF

Substituir o grid linear único por uma navegação fiel ao PDF:

- **Topo**: progresso geral + abas `Seleções` / `História FWC` / `Coca-Cola`.
- **Aba Seleções**: lista expansível por **Grupo** (A–L). Cada grupo abre os 4 países, e cada país mostra um mini-grid 5×4 com os 20 cromos rotulados pelo código (`MEX1`...`MEX20`). Cabeçalho do país com bandeira + nome + contador `x/20`.
- **Aba História FWC**: grid único `FWC1…FWC19` com badge dourado.
- **Aba Coca-Cola**: grid `CC1…CC14` em destaque vermelho.
- Capa `00` aparece como item especial no topo da aba Seleções.
- Mantém: filtros `Tenho / Faltam / Repetidas`, busca (agora por código `MEX12` ou nome do país), bottom sheet de detalhe com +/− repetidas.

## 5. Scan / busca

- Campo de busca aceita código exato (`mex12`, `fwc7`, `cc3`) ou nome do país. Resultados mostram código + país + grupo.
- Botões "Tenho" / "Repetida" continuam funcionando, agora gravando `sticker_code`.

## 6. Trocas

- Componentes que listam figurinhas oferecidas/pedidas passam a exibir o código (`BRA10`) em vez de `#10`.
- Função `nearby_collectors` continua calculando matches, mas usando `sticker_code`.

## Fora do escopo

- Imagens reais dos jogadores (sem dataset disponível) — usamos código + bandeira.
- Nomes individuais dos jogadores em cada cromo (PDF não traz; só o código).
- Reconhecimento por câmera no scanner (continua busca textual; pode virar próximo passo).

## Detalhes técnicos

- Migração SQL única: `DROP` das colunas antigas onde necessário, recriação com tipo `text`, novo seed via `INSERT … SELECT FROM (VALUES …)`.
- `supabase/types.ts` será regenerado após a migração — código consumirá os novos tipos.
- Reset visual do álbum no front: `user_stickers` é zerado pelo schema novo, então usuário recomeça do zero (esperado, pois o catálogo mudou).
