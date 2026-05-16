## Objetivo
Exibir os países de cada grupo na ordem oficial do álbum, em vez da ordem alfabética por código.

## Mudança
Apenas frontend, em `src/lib/stickers.ts`:

1. Adicionar um mapa `COUNTRY_ORDER` (índice 0–3 por `country_code` dentro de cada grupo) refletindo a ordem do álbum:

```
A: MEX, RSA, KOR, CZE
B: CAN, BIH, QAT, SUI
C: BRA, MAR, HAI, SCO
D: USA, PAR, AUS, TUR
E: GER, CUW, CIV, ECU
F: NED, JPN, SWE, TUN
G: BEL, EGY, IRN, NZL
H: ESP, CPV, KSA, URU
I: FRA, SEN, IRQ, NOR
J: ARG, ALG, AUT, JOR
K: POR, COL, COD, UZB
L: ENG, CRO, GHA, PAN
```

2. Alterar `groupByCountry()` para retornar os países ordenados por `(group_letter, COUNTRY_ORDER[country_code])` em vez de pela ordem alfabética que vem do banco.

## Impacto
- Página **Álbum** (`_app.album.tsx`) passa a listar os países na ordem oficial dentro de cada grupo.
- Qualquer outra tela que use `groupByCountry` herda a mesma ordem automaticamente.
- Não muda banco, não muda RLS, não muda figurinhas — só a ordem de exibição.

## Observações
- O código `COD` no banco corresponde a "RD Congo" (nome atualmente armazenado como "Congo"); a ordenação usa o código, então funciona normalmente. Posso ajustar o `country_name` para "RD Congo" se você quiser — me avise.
