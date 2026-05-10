## Objetivo

Deixar óbvio o ciclo "não tenho → tenho → repetida" no álbum, e tornar o acesso à tela de Repetidas visível em mais lugares (perfil + home opcional).

## 1. Nova lógica de toque na figurinha (`_app.album.tsx`)

Comportamento progressivo no toque curto:

- **0 (não tenho)** → 1 toque vira **1 (tenho)**.
- **1 (tenho)** → 1 toque vira **2 (repetida 2x)**.
- **2+ (repetida)** → 1 toque continua incrementando (3x, 4x...).
- **Toque longo** continua abrindo a sheet de detalhes para diminuir/zerar/ajustar manualmente.

Toasts contextuais:
- "BRA10 adicionada ao álbum ✅"
- "BRA10 agora é repetida (2x) 🔁"
- "BRA10 +1 repetida (3x)"

Implementação: substituir `onCellTap` por um `cycle(s)` que chama `setSticker(code, true, dup+1)` (ou `addDuplicate` quando já owned). Manter `toggleOwned`/sheet para casos de remoção.

## 2. Estados visuais mais claros (`StickerCell`)

Três estados distintos:
- **Faltando**: cartão acinzentado + cadeado (mantido).
- **Tenho (1x)**: borda verde/primary + selo ✓ canto sup. direito (mantido, mas reforçar contraste).
- **Repetida (2x+)**: borda dourada (gold), brilho `glow-gold`, selo "Nx" maior e em pílula dourada cobrindo o canto. Adicionar pequeno ícone `Repeat2` ao lado do número para reforçar leitura.

Legenda curta abaixo dos filtros (substitui a frase atual "Toque para marcar... longo para ajustar"):
> "1 toque marca · toque de novo vira repetida · toque longo abre detalhes"

E uma mini legenda visual (3 chips com cor + label): `🟢 Tenho`, `🟡 Repetida`, `⬜ Falta`.

## 3. Atalho "Repetidas" no perfil (`_app.profile.tsx`)

Adicionar um card destaque entre o card do usuário e o bloco PRO:

```text
[ 🔁  Minhas Repetidas        N trocáveis  → ]
```

- Glass + borda gold, ícone `Repeat2` no círculo dourado.
- Mostra contagem de excedentes (`sum(duplicates-1)`) usando `useAlbum()`.
- Linka para `/duplicates`.
- Esconde o card quando contagem = 0 (mostra texto leve "Nenhuma repetida ainda").

## 4. Quick-action na home (opcional, mesma lógica)

Adicionar um chip/atalho na home (`_app.home.tsx`) com ícone `Repeat2` + contagem, ao lado dos atalhos existentes, levando a `/duplicates`. Só aparece quando há repetidas.

## Arquivos afetados

- `src/routes/_app.album.tsx` — nova lógica de tap, estilos por estado, legenda.
- `src/routes/_app.profile.tsx` — card "Minhas Repetidas".
- `src/routes/_app.home.tsx` — chip atalho (se aprovado).

## Sem mudanças

- Schema/Supabase, `useAlbum`, rota `/duplicates` (já existe).

Quer que eu inclua também o atalho na home (item 4) ou só perfil + álbum?
