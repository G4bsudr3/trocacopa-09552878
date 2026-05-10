## Por que está lento

- Cache do React Query desligado: `staleTime: 0` em todo lugar → cada visita à Home/Near/Trades refaz tudo no Supabase.
- RPC `match_collectors` (consulta pesada) é chamada em Home + Near sem reutilização.
- `_app.tsx` espera `loading` do auth (getSession + fetchProfile) antes de renderizar a casca da app, então a primeira tela parece travada.
- Realtime do toast re-cria o channel toda vez que `profile.notification_prefs` muda.
- `leaflet` (mapa do Near) e `qrcode.react` (sheet de convite) são importados eager, então pesam no bundle inicial mesmo quando não usados.
- Em `_app.near.tsx` o `useQuery` consulta `trades` duas vezes seguidas (give/receive) — dá pra unir em uma chamada só.

## Plano

1. **Cache global do React Query**
   - Em `src/router.tsx`, configurar `QueryClient` com `defaultOptions: { queries: { staleTime: 60_000, gcTime: 5*60_000, refetchOnWindowFocus: false, retry: 1 } }`.
   - Tirar `defaultPreloadStaleTime: 0` (deixar default 30s) para o preload do TanStack realmente reaproveitar dados.

2. **Cache específico nas queries pesadas**
   - `match_collectors` (Home `featured-match` e Near `nearby`): `staleTime: 2 * 60_000`, `placeholderData: keepPreviousData` para não piscar entre navegações.
   - `user_stickers` da Home (`album-dups`): `staleTime: 30_000`.
   - Trades list e notifications: `staleTime: 30_000`.

3. **Render imediato da casca em `_app.tsx`**
   - Não bloquear o layout inteiro com `loading`; mostrar `Outlet` assim que tiver `session` (mesmo sem `profile`), e fazer o splash só enquanto `session === undefined`.
   - Mover o `useEffect` do realtime para depender apenas de `user?.id` (ler `prefs` via `ref` ou recomputar dentro do callback). Evita re-subscribe a cada update de profile.

4. **Lazy-load de bibliotecas pesadas**
   - `NearMap` (leaflet) → `const NearMap = lazy(() => import("@/components/NearMap"))` + `<Suspense>` dentro de `_app.near.tsx`.
   - `InviteFriendSheet` (qrcode.react) → lazy no `_app.profile.tsx`, só monta quando o usuário clica em "Convidar amigo".
   - Conferir `framer-motion` em telas que só usam 1 fade simples; trocar por CSS quando trivial.

5. **Limpar duplicação no Near**
   - `_app.near.tsx`: unir as duas chamadas a `trades` (linhas 86 e 96) em uma só com `or(...)` ou pegar tudo onde o user é participante e filtrar no client.

6. **Pré-warm do perfil**
   - Em `auth.tsx`, passar o `profile` direto via `queryClient.setQueryData(["profile", uid], data)` depois do `fetchProfile`, e nas telas trocar leituras diretas por `useQuery(["profile", uid], ...)` com `staleTime: Infinity` enquanto a sessão durar.

## Detalhes técnicos

- `keepPreviousData` vem de `@tanstack/react-query` v5 como `placeholderData: keepPreviousData`.
- Manter `enabled: !!user` em todas as queries que dependem do user.
- Não mexer em RLS nem em migrations — é só perf de frontend + config de cliente.
- Não tocar em `src/integrations/supabase/client.ts` nem `types.ts`.

## Fora de escopo

- Reescrever `match_collectors` no banco (dá pra otimizar depois com índice/materialized view, mas não agora).
- Mudar layout/responsividade visual — a queixa é tempo de carregamento, não breakpoint.

## Confirmação

Posso seguir com esse plano? Se quiser, posso também já adicionar índices auxiliares no banco para `match_collectors` numa segunda etapa.
