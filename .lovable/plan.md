## Diagnóstico

Confirmei consultando o site `centraldacopa.app` e o banco:

- O **nome** no banco está correto: `MEX12 = Marcel Ruiz` e `MEX14 = Erick Sánchez` (bate com o site).
- Logo o problema é só na **imagem**: o arquivo em `sticker-images/MEX12.jpg` não veio do Firebase oficial — provavelmente foi sobrescrito por um upload manual (PDF/admin) com mapeamento errado.
- Hoje há **104 figurinhas sem imagem nenhuma** (ex.: GER10, BEL5/6/8/11/12/14/19, EGY4/6/8/9/14/15/16, IRN9/14/20, ESP18/19, KSA, CPV, URU, FRA18, SEN17, IRQ, NOR, ARG6/7…), ou seja, gaps reais que precisam ser fechados.
- O `import-checklist` já consegue baixar tudo do Firebase oficial usando `seq` (`https://firebasestorage.googleapis.com/.../WC2026_BR/{seq}.jpg`). Verifiquei que `32.jpg` (MEX12) e `34.jpg` (MEX14) existem e respondem 200.

## Objetivo

Garantir que **todas as imagens** do catálogo venham 100% do site oficial, descartando qualquer arquivo que veio de PDF/upload manual e fechando os 104 gaps.

## Plano

1. **Limpar imagens "sujas" antes do re-import**
   - Ajustar a função `import-checklist` para aceitar `wipe_images: true`: antes de processar, zera `image_url` no banco e **remove os arquivos** do bucket `sticker-images` (lista e deleta em lotes via `storage.remove`).
   - Isso garante que nada de PDF/upload manual sobreviva — só voltam imagens vindas do Firebase oficial.

2. **Re-import completo do site (force)**
   - Executar `import-checklist` em modo:
     - `wipe_images: true` (apenas no primeiro lote)
     - `force: true` (re-baixa imagem mesmo se existir)
     - `skip_images: false`
     - `limit: 200` por chamada, repetindo até `remaining = 0`.
   - Para cada figurinha: baixa `seq.jpg` do Firebase, faz `upload(upsert)` em `sticker-images/{CODE}.jpg`, atualiza `image_url` com cache-buster `?t=...`.

3. **Tratamento de gaps reais**
   - Se o Firebase oficial **não** tem a imagem do `seq` (404), deixar `image_url = NULL` (sem fallback de PDF). Reportar a lista no resultado para conferência.
   - Re-rodar até que `image_failed` se estabilize — esses são casos em que o site ainda não publicou a foto.

4. **Verificação final**
   - Query: `SELECT count(*) FILTER (WHERE image_url IS NULL)` — deve cair drasticamente.
   - Conferir manualmente MEX12 (Marcel Ruiz) e MEX14 (Erick Sánchez) abrindo a imagem nova e validando.

## Detalhes técnicos

**Edição em `supabase/functions/import-checklist/index.ts`:**
- Novo parâmetro `wipe_images` no body.
- Se `wipe_images === true` e o caller é admin:
  ```ts
  // 1) lista todos os objetos em sticker-images
  // 2) deleta em chunks de 100 via admin.storage.from('sticker-images').remove(paths)
  // 3) UPDATE public.stickers SET image_url = NULL
  ```
  Faz isso uma única vez, antes do loop de scrape, e segue para o fluxo normal de re-download.
- Restante do fluxo é o que já existe: scrape por time, `downloadImage(seq)`, upload, upsert no `stickers`.

**Execução (na tela `/admin/stickers` ou via curl autenticado):**
1. 1ª chamada: `{ wipe_images: true, force: true, limit: 200 }`
2. Repetir: `{ force: true, limit: 200 }` até `remaining: 0`.

## Fora de escopo

- Não mexer em nomes/posições (já estão certos via checklist).
- Não tocar em outras buckets (`user-contributions`, `avatars`).
- Não alterar `TOTAL_STICKERS` nem o esquema do banco.
- Não mudar o fluxo de scan da página/figurinha.
