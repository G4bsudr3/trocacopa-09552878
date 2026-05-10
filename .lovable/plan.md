## Bug
`Algo deu errado — cannot add postgres_changes callbacks for realtime:unread-… after subscribe()`

Causa: em `src/lib/use-unread-notifications.ts`, o `useEffect` cria um canal Realtime com nome fixo (`unread-${user.id}`). No StrictMode (dev), o efeito monta → desmonta → monta. O cleanup chama `removeChannel`, mas o cliente Supabase mantém o canal cacheado por nome, então a segunda chamada a `supabase.channel("unread-…")` devolve a instância já `subscribe()`-ada e o `.on()` seguinte estoura.

## Correção
Em `src/lib/use-unread-notifications.ts`:
- Antes de criar o canal, remover qualquer canal pré-existente com o mesmo topic (`supabase.getChannels().filter(c => c.topic.endsWith("unread-…")).forEach(removeChannel)`), e
- Construir o canal na ordem correta dentro do efeito (`channel → on → subscribe`) garantindo que `.on()` aconteça antes do `.subscribe()` (já está, mas o canal precisa ser novo).

Aplico a mesma proteção em `src/routes/_app.tsx` no canal `notif-toast-${user.id}`, que tem o mesmo padrão e vai estourar do mesmo jeito assim que alguém receber 2 notificações em sequência ou em StrictMode.

## Fora do escopo
- Não mexo em RLS, schema, ou outras telas.
- Não troco a lib de realtime nem desligo StrictMode.
