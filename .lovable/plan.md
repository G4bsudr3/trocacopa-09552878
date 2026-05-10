## Mudança

O card de resultado e a lista "Você quis dizer?" **já usam `image_url`** com fallback para emoji+código (`src/routes/_app.scan.tsx`, linhas 196 e 339). O que ainda mostra só o placeholder é a seção **"Recentes"** (histórico de scans, linhas 429–453), que renderiza apenas emoji da bandeira + código.

## O que vou fazer

Em `src/routes/_app.scan.tsx`, na seção `{recent.length > 0 && ...}`:

- Para cada código recente, buscar a figurinha no catálogo (já é feito).
- Se `s.image_url` existir, renderizar a foto real (`<img src={s.image_url}>`) em formato de figurinha (proporção retrato, cantos arredondados, ring sutil).
- Se não existir, manter o fallback atual (bandeira + código no card gradiente).
- Manter o nome do país e o link "Ver álbum completo".

Visual: cards 3-colunas, imagem ocupando a maior parte do card, código e país abaixo. Mantém o estilo `glass`/`rounded-xl` já usado.

## Fora do escopo

- Não mexo no card de resultado (já usa `image_url`).
- Não mexo na lista de sugestões (já usa `image_url`).
- Não mexo no backend, no scanner ou na lógica de doação.
- Não troco placeholders fora da tela de Escanear.

Posso aplicar?
