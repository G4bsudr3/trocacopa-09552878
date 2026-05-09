## Objetivo

Finalizar **Notificações** + **Configurações** com comportamento real, e remover os mocks restantes (botão "Em breve" do Pro, exclusão de conta incompleta).

---

## 1. Notificações — `_app.notifications.tsx`

- **Marcar individual como lida** ao clicar (atualmente só "marcar todas").
- **Apagar notificação** com swipe/botão (ícone X discreto à direita).
- **Apagar todas** (botão secundário no topo, ao lado de "Marcar como lidas").
- **Filtro por tipo** (Todas / Trocas / Mensagens) — chips no topo.
- **Empty state com CTA** levando para `/near` ("Encontre colecionadores perto").
- Manter realtime já existente.

## 2. Configurações — `_app.settings.tsx`

- **Atualizar GPS agora**: botão real que chama `navigator.geolocation` e grava `lat`/`lng` no `profiles` (hoje só linka pra `/profile/edit`).
- **Tema**: toggle Dark/Light (persistido em `localStorage`, aplicado via classe no `<html>`).
- **Privacidade**: toggle "Aparecer no radar de colecionadores" → coluna `profiles.discoverable boolean default true` (respeitada pelo RPC `nearby_collectors`).
- **Exclusão de conta real**: chamar edge function `delete-account` que apaga o `auth.user` via service role (hoje só apaga linha do `profiles`, deixa órfão no auth).
- **Sobre / Versão**: linha estática com versão do app + link para política (placeholder de URL externa).

## 3. Limpeza de mocks

- **`_app.pro.tsx`**: botão "Assinar" hoje só toasta "Em breve". Trocar por uma tela honesta — modal "Pré-cadastro: avise-me quando lançar" que grava em tabela `pro_waitlist (user_id, created_at)`. Sem cobrança fake.
- **`_app.profile.tsx`**: nada a remover (dados já vêm do banco). Manter.
- Confirmar varredura: nenhum outro `mock`/`TODO`/dado hardcoded restante nos routes.

---

## Detalhes técnicos

### Migração SQL
```sql
ALTER TABLE profiles ADD COLUMN discoverable boolean NOT NULL DEFAULT true;

CREATE TABLE pro_waitlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pro_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self insert" ON pro_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self select" ON pro_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Atualizar nearby_collectors() para filtrar WHERE discoverable = true
```

### Edge Function `delete-account`
- Verifica JWT do chamador.
- Usa `SUPABASE_SERVICE_ROLE_KEY` para `supabase.auth.admin.deleteUser(user.id)`.
- Cascade já remove profile/stickers/trades.

### Tema
- Hook `useTheme()` em `src/lib/use-theme.ts` (lê/grava `localStorage.theme`, alterna classe `dark` no `documentElement`).
- Adicionar bloco mínimo de tokens light em `styles.css` se ainda não houver — caso contrário, manter dark-only e ocultar o toggle. **Vou verificar antes de implementar.**

### Realtime / queries
- Usar `useMutation` para delete + invalidar `["notifications", user.id]`.
- Click em item: `update notifications set read=true where id=$1`.

---

## Fora de escopo

- Cobrança real do Pro (Stripe) — só pré-cadastro.
- Push notifications nativas — só in-app + realtime.
- i18n / acessibilidade WCAG completa.
