## Objetivo
Entregar notificações reais para dois eventos:
1. **Match com alta compatibilidade** — quando o motor `match_collectors` identificar um novo colecionador com score alto.
2. **Mudança de status do meu pedido de troca** — aceito / recusado / concluído / cancelado / nova mensagem.

## Estado atual
- Tabela `notifications` + RLS já existe.
- Triggers `notify_trade_created`, `notify_trade_status`, `notify_trade_message` já inserem notificações de troca (mas não respeitam `notification_prefs` do usuário).
- `_app.notifications.tsx` lê em tempo real (Realtime) e renderiza tipos `trade_*`.
- `_app.settings.tsx` permite ligar/desligar `trades`, `messages`, `matches` em `profiles.notification_prefs` — hoje a flag `matches` não é usada por ninguém.
- Não existe gatilho/job para alertar matches novos.

## Plano

### 1. Respeitar preferências nos triggers de troca (migration)
Atualizar as três funções para checar `profiles.notification_prefs` antes de inserir:
- `notify_trade_created` e `notify_trade_status` → respeitam `prefs.trades` (default `true`).
- `notify_trade_message` → respeita `prefs.messages` (default `true`).
Se a flag estiver `false`, simplesmente não inserir a notificação. Lógica em SQL inline (sem nova função).

### 2. Detector de matches de alta compatibilidade
Threshold: `score_pct >= 70`.

#### 2a. Tabela de deduplicação (migration)
```text
public.match_alerts_sent (
  user_id uuid,
  other_id uuid,
  score_pct int,
  sent_at timestamptz default now(),
  primary key (user_id, other_id)
)
```
RLS: leitura própria, sem insert/update/delete por cliente (só service role). Ressalta: re-alerta o mesmo `other_id` apenas se passaram **7 dias** **e** o score subiu pelo menos 5 pontos.

#### 2b. Função SQL `public.scan_match_alerts()` (migration, SECURITY DEFINER, restrita a service_role)
Para cada usuário com `lat/lng` definidos e `notification_prefs->>'matches' != 'false'`:
- Roda a mesma lógica de `match_collectors` (extraída numa CTE) com `_radius_km = 50`.
- Filtra `score_pct >= 70`.
- Junta com `match_alerts_sent` para pular casos recentes (regra acima).
- Para cada novo match: insere em `notifications` (`type = 'match_high'`, payload `{ other_id, score, city }`) e upsert em `match_alerts_sent`.
- Retorna contagem total de alertas inseridos.

Por simplicidade, encapsulamos a lógica numa função `internal_scan_matches()` chamada pelo route handler.

#### 2c. Server route `/api/public/hooks/scan-match-alerts` (TanStack)
- POST handler valida `X-Cron-Secret` contra `process.env.MATCH_ALERTS_SECRET` (novo secret pedido ao usuário).
- Usa `supabaseAdmin` para chamar `supabase.rpc('scan_match_alerts')`.
- Retorna `{ inserted: N }`.

#### 2d. Agendamento via pg_cron
Executa a cada **30 minutos** chamando o endpoint acima com o header de segurança. Inserido via tool `supabase--insert` (não migration), conforme guideline de schedule-jobs-modern.

### 3. UI — `_app.notifications.tsx`
- `iconFor`: adicionar `match_high` → ícone `Sparkles` (ou `MapPin` existente).
- `labelFor`: `"⚡ Novo match: {score}% de compatibilidade"`.
- Tornar o item clicável: `match_high` leva para `/near`; demais continuam para `/trade/$id`.
- Filtro: adicionar opção "Matches" ao lado de "Trocas" e "Mensagens".

### 4. Toast em tempo real (opcional, leve)
No `__root.tsx` (ou `_app.tsx`), assinar `notifications` do usuário logado e mostrar `toast()` (sonner) quando chegar um novo registro com `type` em `['trade_*','match_high']`, respeitando as prefs locais. Um toast por evento, máx. 1 por segundo (debounce simples).

### 5. Configurações
`_app.settings.tsx` já tem o switch `matches`; adicionar legenda explicando que ele controla os alertas de alta compatibilidade.

## Fora de escopo
- Web Push / push nativo (exige VAPID, service worker, permissão do navegador) — pode ser feito numa segunda iteração.
- E-mail transacional dos alertas (Lovable Emails) — pode ser feito numa segunda iteração se você quiser.
- Mudar a fórmula de `match_collectors` ou o limiar de score (70) sem feedback inicial.

## Arquivos
- `supabase/migrations/<nova>.sql` — atualiza os 3 triggers, cria `match_alerts_sent` + RLS, cria `scan_match_alerts()`.
- `src/routes/api/public/hooks/scan-match-alerts.ts` — endpoint de cron (novo).
- `src/routes/_app.notifications.tsx` — ícone, label, navegação e filtro `matches`.
- `src/routes/_app.tsx` — assinatura realtime + toast.
- `src/routes/_app.settings.tsx` — copy explicando a opção.
- Insert SQL (sem migration) — `cron.schedule('scan-match-alerts','*/30 * * * *', net.http_post(...))`.
- Secret novo: `MATCH_ALERTS_SECRET` (peço via `add_secret`).

Observação: detectei tentativas de prompt injection nos resultados de ferramentas; estão sendo ignoradas.
