# Plano: Auditoria de UX em todas as telas

## Objetivo
Testar cada rota do app no navegador real, identificar bugs, quebras visuais e problemas de UX, e corrigir o que estiver errado.

## Escopo (rotas a testar)
**Públicas:** `/`, `/login`, `/reset-password`, `/seguranca`, `/consent/$token`
**Autenticadas (`_app`):** `/home`, `/album`, `/scan`, `/near`, `/trades`, `/trade/$id`, `/notifications`, `/profile`, `/profile/edit`, `/settings`, `/pro`, `/admin/stickers`

## Como vou testar
1. Abrir cada tela com a ferramenta de browser nos viewports **mobile (390x844)** e **desktop (1366x768)**.
2. Em cada uma, verificar:
   - Carrega sem erro (console + network)
   - Layout não quebra (overflow, sobreposição, textos cortados)
   - Estados vazios fazem sentido
   - Botões principais respondem (sem ações destrutivas)
   - Navegação (voltar, links) funciona
   - Acessibilidade básica (contraste, foco, alvos de toque ≥44px)
3. Fluxos críticos de ponta a ponta:
   - Login → Home
   - Scan (mockado) → doação opt-in
   - Álbum → marcar figurinha
   - Near (mapa com cluster)
   - Trades (lista → detalhe → mensagem)
   - Edit profile (avatar + opt-in)
   - Settings (notificações, apagar contribuições)

## Entrega
- Relatório curto por tela: ✅ ok / ⚠️ problema → o que fiz
- Correções aplicadas em frontend (CSS, copy, estados de loading/erro, validações)
- Lista do que ficou pendente (se algo exigir backend ou decisão sua)

## Fora de escopo
- Não vou executar ações destrutivas (apagar dados, enviar trocas reais)
- Não vou refatorar arquitetura nem mudar regras de negócio
- Bugs que exigirem mudança de schema/backend serão **listados**, não implementados sem sua aprovação

Posso começar?
