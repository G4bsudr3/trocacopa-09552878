
## Objetivo

Remover todos os dados mockados (`mock-data.ts`, `localStorage` do álbum, avaliações fake, notificações fake) e ligar tudo ao Supabase com autenticação real, geolocalização do navegador e fluxo completo de troca entre usuários.

## Fases

### Fase 1 — Schema do banco (migration única)

Criar tabelas:

- **`stickers`** — catálogo público das 640 figurinhas (number, name, team, group). Populada uma única vez via seed.
- **`user_stickers`** — `(user_id, sticker_number, duplicates)` — substitui o localStorage. RLS: dono lê/escreve; outros usuários autenticados podem ler para cálculo de match.
- **`profiles`** — adicionar colunas `lat`, `lng`, `location_updated_at`, `bio`.
- **`trades`** — `(id, requester_id, receiver_id, status, offered_stickers[], requested_stickers[], created_at)`. Status: `pending`, `accepted`, `declined`, `completed`.
- **`trade_messages`** — chat de cada troca `(trade_id, sender_id, content, created_at)`.
- **`notifications`** — `(id, user_id, type, payload jsonb, read, created_at)`. Triggers criam notificação ao receber pedido de troca, mensagem ou match.
- **`reviews`** — `(reviewer_id, reviewed_id, trade_id, stars, comment)`.

Storage:
- bucket público **`avatars`** com policies (qualquer um lê, dono escreve no próprio folder).

Função SQL `nearby_collectors(radius_km)` com fórmula Haversine, retornando usuários próximos + contagem de figurinhas que o solicitante precisa e que o vizinho tem em duplicata (= match score real).

### Fase 2 — Álbum real

- Novo hook `use-album.ts` lendo de `user_stickers` via TanStack Query.
- `toggleOwned`, `addDuplicate`, `removeDuplicate` viram mutations no Supabase com optimistic update.
- Remover `src/lib/mock-data.ts` (manter só types do catálogo, vindo do banco).
- Atualizar `_app.album.tsx` para usar hook novo + skeleton loading.
- `album_progress` no profile é atualizado via trigger SQL sempre que `user_stickers` muda.

### Fase 3 — Perfil real

- Tela `/profile/edit` (nova rota) com formulário Zod: nome, cidade, bio, upload de avatar para bucket `avatars`.
- Botão "Atualizar minha localização" pede `navigator.geolocation`, salva `lat`/`lng` no profile.
- Substituir contagens fixas (`trades=24`, `scanned=187`) por queries reais.
- Avaliações vêm da tabela `reviews`.
- Logout já funciona — manter.

### Fase 4 — Trocas e Perto de Mim reais

- `_app.near.tsx`: chama `nearby_collectors(radius)` usando lat/lng do usuário; se sem GPS, mostra empty state pedindo para ativar localização no perfil.
- `_app.trade.$id.tsx`: carrega troca real; chat usa `trade_messages` com Supabase Realtime.
- Botão "Propor troca" em cada colecionador cria registro em `trades` (status pending) e dispara notificação.
- `_app.trades.tsx`: lista trocas reais do usuário (recebidas + enviadas), com tabs.

### Fase 5 — Notificações e configurações

- `_app.notifications.tsx`: lê tabela `notifications` em realtime, marca como lida ao abrir.
- Badge no bottom nav com contagem de não lidas.
- Tela `/settings` (nova) ligada ao botão de menu: editar perfil, gerenciar localização, alternar notificações por tipo (campo `notification_prefs jsonb` no profile), excluir conta, sair.

### Fase 6 — Limpeza

- Deletar `src/lib/mock-data.ts` e `mockNotifications`/`mockCollectors`.
- Remover dados estáticos de `profile.tsx` (badges fake calculados a partir de `trades_count` real).
- Tela Scan: manter UI mas, ao confirmar uma figurinha "escaneada", grava de verdade em `user_stickers`.

## Detalhes técnicos

- Todas as leituras críticas via `createServerFn` + `requireSupabaseAuth`; mutations simples direto do client com RLS.
- Realtime habilitado em `notifications`, `trade_messages`, `trades`.
- Catálogo de stickers seedado pela migration (INSERT de 640 linhas geradas a partir dos arrays existentes em `mock-data.ts`).
- Geolocalização: `navigator.geolocation.getCurrentPosition` com fallback para cidade-only se o usuário negar.

## Fora de escopo

- Sistema de pagamento Pro (deixar tela como está por enquanto).
- Push notifications nativas (apenas in-app por agora).
- Reconhecimento de imagem real no Scan (mantém seleção manual).
