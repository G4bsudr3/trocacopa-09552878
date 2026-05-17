## Diagnóstico

Hoje o catálogo tem 980 figurinhas. Destas:
- **805** com imagem real do álbum (`.jpg` vindo do site Central da Copa)
- **175** com a imagem **genérica** SVG (gerada localmente pela função `generate-sticker-images` como fallback) — todas do tipo `player`
- 0 sem imagem

A função `import-checklist` (que baixa as imagens reais do site original) só tenta novamente quando `image_url IS NULL`. Como o fallback genérico preencheu o campo com a URL do SVG, ela está pulando essas 175.

## Plano

1. **Limpar somente as 175 imagens genéricas**, colocando `image_url = NULL` apenas onde a URL aponta para `/sticker-images/players/*.svg` (não toca nas 805 boas).
2. **Rodar `import-checklist` com `{ resume: true, limit: 200 }`**, que baixará novamente do site `centraldacopa.app` apenas as figurinhas com `image_url` nulo.
3. **Conferir o resultado** com uma query: quantas ficaram com `.jpg` real, quantas continuam faltando (caso o site não tenha o arquivo de alguma).
4. **Para as que permanecerem faltando** (provavelmente nenhuma, mas se acontecer), oferecer duas opções:
   - manter o placeholder genérico atual, ou
   - tentar novamente outra fonte.

Nenhuma mudança de UI, schema ou RLS — só dados.

## Detalhes técnicos

- O update de `image_url = NULL` precisa de migration (UPDATE não é permitido via insert tool).
- A função `import-checklist` já está deployada e usa `seq = stickers.position` para montar a URL `https://firebasestorage.googleapis.com/.../WC2026_BR/{seq}.jpg`.
- O loop processa 200 por chamada (`limit`), então uma única invocação cobre as 175.
- Risco baixo: se o download falhar para algum código, a função grava `image_url = ""` (marcador "tentado, indisponível"); podemos re-gerar o SVG genérico depois para esses casos específicos.