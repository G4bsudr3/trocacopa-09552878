## Objetivo

Quando a IA reconhece a figurinha (ou jogador/país), mostrar a **foto oficial real** da figurinha (`stickers.image_url`) no card de resultado, junto com o estado atual de posse (não tenho / tenho / quantas repetidas), e ajustar os botões para refletir esse estado.

Apenas mudanças de UI no scanner — nenhuma alteração na edge function `scan-sticker` nem em banco.

## Mudanças em `src/routes/_app.scan.tsx`

### 1. Novo estado `result`

Adicionar `const [result, setResult] = useState<Sticker | null>(null)` (tipo do `useStickerCatalog`). Guarda a figurinha identificada pela IA com confiança alta.

Quando `handleFile` encontrar um `code` válido no catálogo:
- Em vez de só setar `setQuery(real.code)`, fazer `setResult(real)` (e limpar `setSuggestions([])`, `setQuery("")`).

### 2. Card de resultado (substitui o uso atual de `matches` quando há `result`)

Renderizado logo abaixo do botão de tirar foto, antes da busca manual. Layout:

```text
┌─────────────────────────────────────┐
│  [foto oficial 96x128]  BRA10  🇧🇷  │
│   (image_url, nítida)   Vinícius Jr │
│                         Grupo G·pos10│
│                                      │
│   [✓ Possuída]  [+1 Repetida 🔁 x2] │
│   [Não é essa] [Trocar foto]         │
└─────────────────────────────────────┘
```

Detalhes visuais:
- `<img src={result.image_url} />` em `w-24 h-32 rounded-xl object-cover` com `glass-strong` ring; fallback para o bloco gradient + flag_emoji atual quando `image_url` é null.
- Badge dourado `x{duplicates}` no canto da imagem se `duplicates > 1`.
- Botão "Tenho" vira `✓ Já possuída` (disabled visual) quando `owned === true`; clicar volta a chamar `toggleOwned`.
- Botão "Repetida" mostra contagem atual: `+1 Repetida` e, se `duplicates >= 1`, "x{duplicates+1}".
- "Não é essa" → limpa `result` e mostra `suggestions` (se vieram) ou volta para busca manual.
- "Trocar foto" → reabre `fileRef`.

### 3. Suggestions e matches list — também usar foto

Nos blocos `suggestions.map(...)` (linhas 188-206) e `matches.map(...)` (linhas 213-255):
- Buscar a sticker no catálogo (`catalog.data.find`) para obter `image_url`.
- Substituir o quadradinho `gradient-primary + flag_emoji` por `<img src={image_url} className="w-10 h-14 rounded-lg object-cover" />` quando disponível; manter o fallback gradient+flag quando `image_url` for null.
- Em `matches`, também: se `duplicates > 1`, exibir badge dourado pequeno `x{n}` sobre a thumbnail; manter os dois botões mas desabilitar "Tenho" quando já owned.

### 4. Limpeza

- `register()` passa a também chamar `setResult(null)` ao final.
- Fechar o preview (`X`) limpa `result` e `suggestions` também.

## Fora de escopo

- Não muda a edge function `scan-sticker`.
- Não muda nada no álbum/cadastro.
- Não adiciona novos campos no banco — usa `image_url` já existente nos 936 stickers (104 que ainda não têm imagem caem no fallback do bloco gradient+flag).

## Arquivos

- `src/routes/_app.scan.tsx` (única edição)
