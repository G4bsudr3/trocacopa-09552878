
# Sino com contador de não lidas na navbar + sincronia com filtro

Hoje o sino só aparece no cabeçalho da `/home` (com badge). A `BottomNav` não tem ícone de notificações, e o filtro da página `/notifications` (Todas / Matches / Trocas / Mensagens) não conversa com o badge.

## O que vamos fazer

### 1) Hook compartilhado `useUnreadNotifications`
Novo arquivo `src/lib/use-unread-notifications.ts`:
- Faz `select id, type, read` em `notifications` do usuário (limite 200).
- Inscreve em Realtime no `INSERT/UPDATE/DELETE` da tabela e invalida automaticamente.
- Retorna `{ total, byCategory: { trades, messages, matches } }` calculado a partir dos não lidos.
- Categoriza pelo `type`:
  - `trade_message` → `messages`
  - `match_high` → `matches`
  - demais `trade_*` → `trades`
- `staleTime` curto (10s) e mesma `queryKey: ["unread", userId]` em todos os consumidores.

### 2) Sino na BottomNav
- Adicionar um botão extra de "Notificações" na BottomNav, posicionado entre `Perto` e `Perfil` (ou substituir conforme couber visualmente — vou manter os 5 atuais e inserir o sino como ícone flutuante no canto superior direito da própria navbar para não quebrar o grid de 5 abas com botão central).
- Decisão: adicionar **um sino fixo no topo direito da tela (header global flutuante)** dentro de `_app.tsx`, sempre visível em todas as rotas, com badge consumindo `useUnreadNotifications().total`. Isso evita reorganizar a BottomNav e garante presença em todas as páginas.
- Visual: pílula glass com `Bell` + badge numérico (99+ quando > 99), oculta enquanto a contagem é 0 e o usuário está na própria página `/notifications`.

### 3) Sincronia com o filtro
- O filtro atual da `/notifications` usa `useState`. Vamos mover para search param (`?filter=all|trades|messages|matches`) usando `validateSearch` + `Route.useSearch` + `useNavigate`. Assim:
  - O sino global pode linkar `/notifications?filter=matches` (ou outro) baseado em onde estiver a maior contagem não lida — opcionalmente abrindo um mini popover com as 3 categorias e respectivos contadores.
  - O filtro fica compartilhável e reativo.
- Pequeno popover ao tocar no sino (ou ao manter): mostra três linhas — Trocas (n), Mensagens (n), Matches (n) — cada uma navega para `/notifications?filter=...`. Em telas pequenas, um único toque vai direto pra `/notifications` mantendo o filtro atual; o popover abre apenas em hover/long-press.
- Para simplicidade e consistência mobile-first: o sino navega para `/notifications` sem filtro pré-aplicado, **mas** quando o usuário trocar o filtro lá dentro, o badge do sino destaca um indicador colorido conforme a categoria com mais não lidas (gold = matches, primary = trades, accent = messages). Essa é a "sincronia visual" entre filtro e badge.

### 4) Substituir o badge antigo da `/home`
- Atualizar `_app.home.tsx` para usar o mesmo hook `useUnreadNotifications` (em vez da query separada `unread-count`), garantindo um único ponto de verdade.

### 5) Limpeza
- Remover a query duplicada `unread-count` em `_app.home.tsx`.
- Garantir que o canal Realtime do hook não duplique com o canal de toasts já existente em `_app.tsx` (canais com nomes distintos, ok).

## Arquivos afetados
- `src/lib/use-unread-notifications.ts` (novo)
- `src/routes/_app.tsx` (sino flutuante + import do hook)
- `src/routes/_app.notifications.tsx` (filtro via search param + sincronia)
- `src/routes/_app.home.tsx` (consumir o novo hook)

## Fora de escopo
- Push notifications nativas, agrupar notificações por troca, marcar lida ao passar mouse, sons.
