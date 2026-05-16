## Diagnóstico

**1. FWC2..FWC8** — verifiquei: as 9 figurinhas FWC00, FWC1..FWC8 existem na tabela `stickers` (`kind='special'`) e todas as imagens retornam HTTP 200 no storage (tamanhos ~70–160 KB). Ou seja, no banco/storage está tudo certo. Se elas "não aparecem no app", pode ser:
   - bug visual na aba **Especiais** (renderização/ordenação),
   - cache antigo do React Query (TTL de 1h),
   - ou o usuário está olhando a aba errada (FWC9..FWC19 são `kind='history'`, aparecem dentro de **Seleções → SPECIAL**, não em Especiais).

**2. Imagens faltando** — 175 figurinhas estão com `image_url` vazio (NULL ou `''`). Exemplos: NZL3, NZL7, NZL8, NZL12, NZL16, NZL19, NZL20, e dezenas de outras (BEL5/6/8, EGY4/6/8, IRN3/4, ESP4/6/7, etc). Todas são `kind='player'`.

A edge function `generate-sticker-images` já existe e gera SVG placeholder por jogador, mas só processa onde `image_url IS NULL`. Como muitas têm `image_url = ''` (string vazia), elas são ignoradas. Além disso, é um botão admin manual — não roda sozinho.

**3. Admin** — encontrei dois perfis: `Juan Kleber` (`f47c52dc…`) e `Juan (Admin)` (`8db05199…`). Preciso confirmar pelo e-mail real em `auth.users` (vou fazer dentro de uma migração que tem permissão).

---

## Plano de ação

### Passo 1 — Forçar regeneração de imagens (item 2)
- Migração SQL: normalizar `image_url = ''` para `NULL` nos 175 registros, para que a edge function reconheça como pendente.
- Ajustar a edge function `generate-sticker-images` para:
  - tratar `''` como ausente (where `image_url IS NULL OR image_url = ''`),
  - aumentar limite default e processar em lote,
  - retornar progresso.
- Rodar a função (admin → endpoint) para gerar SVG placeholder das 175. Imagens reais de jogadores não estão disponíveis publicamente; o placeholder mantém cor da seleção + número da camisa + código + bandeira (mesmo padrão já usado nos demais jogadores).

> ⚠️ Importante: **não tenho acesso às fotos oficiais dos jogadores** (Panini). O que vai aparecer é a arte placeholder colorida, igual à que já existe para os outros 805 jogadores. Se você quiser fotos reais, precisa enviar as imagens (zip) ou usar um catálogo licenciado.

### Passo 2 — Tornar juan.kleberstyle@gmail.com admin (item 3)
- Migração que insere em `user_roles` o `role='admin'` para o `user_id` correspondente ao e-mail `juan.kleberstyle@gmail.com` (busca via `auth.users` dentro da migração, que tem permissão).

### Passo 3 — Investigar FWC2..FWC8 (item 1)
Antes de mexer no código, preciso entender o que você está vendo. Vou perguntar abaixo.

---

## Técnico (resumo)
- Migração #1: `UPDATE stickers SET image_url=NULL WHERE image_url=''`.
- Migração #2: `INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email='juan.kleberstyle@gmail.com' ON CONFLICT DO NOTHING`.
- Edit em `supabase/functions/generate-sticker-images/index.ts`: filtro `.or('image_url.is.null,image_url.eq.')` e limite 500+.
- Após deploy, chamar a função autenticado como admin para popular as 175.