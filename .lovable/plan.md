## Problema

Nas figurinhas faltantes (com cadeado), o código fica minúsculo (8px) na barrinha inferior e quase ilegível por causa do overlay escuro + cadeado central grande. Difícil saber qual figurinha está sendo marcada.

## Solução

Reorganizar o `StickerCell` no estado **faltante** para que o **código seja o elemento principal** da célula:

### Estado faltante (não-owned)
- Imagem segue dim/blur (sem mudar a opacidade que já está 0.75 + blur), mas overlay escuro fica **mais sutil** (`from-background/70 via-background/30`) para não engolir o código.
- **Código grande e nítido no centro**: `font-display text-lg md:text-xl text-foreground` com `drop-shadow` forte para destacar sobre a imagem.
- Logo abaixo do código, bandeira pequena + nome do país abreviado em `text-[10px] text-muted-foreground`.
- Cadeado pequeno (10px) movido para o **canto inferior direito** dentro de um chip glass mini, em vez de ocupar o centro.
- Remover a barra inferior de código (que duplica e fica em 8px).

### Estado owned / repetido
- Mantém como está: imagem nítida + barra inferior com código (mas aumenta de `text-[8px]` para `text-[10px]` para ficar legível também).

### Variante sem imagem (`!s.image_url`)
- Aumentar o código de `text-[10px]` para `text-sm font-bold`.

## Arquivo afetado

- `src/routes/_app.album.tsx` — apenas o componente `StickerCell` (linhas ~409-473). Sem mudanças em lógica, dados ou outros componentes.
