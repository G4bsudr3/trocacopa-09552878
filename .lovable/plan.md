## Criar usuários de teste

Criar 3 usuários no sistema de autenticação com perfis e roles configurados:

### 1. Admin
- **Email:** juan@trocacopa.com.br
- **Senha:** trocacopa123
- **Nome:** Juan (Admin)
- **Plano:** pro
- **Role:** admin (inserido em `user_roles`)

### 2. Usuário Pro
- **Email:** pro@trocacopa.com.br
- **Senha:** trocacopa123
- **Nome:** Usuário Pro
- **Plano:** pro
- **Role:** user

### 3. Usuário Comum
- **Email:** user@trocacopa.com.br
- **Senha:** trocacopa123
- **Nome:** Usuário Comum
- **Plano:** free
- **Role:** user

### Como será feito
Como `auth.users` não pode ser populado via SQL migration de forma segura (senhas precisam de hash bcrypt do GoTrue), vou criar uma **edge function temporária** (`seed-test-users`) que usa `supabaseAdmin.auth.admin.createUser()` com `email_confirm: true` para criar os 3 usuários já confirmados. Em seguida, insere/atualiza:
- `profiles` (full_name, plan, city default)
- `user_roles` (admin para o Juan)

Depois invoco a função uma única vez via `curl_edge_functions` e confirmo o resultado.

### Fora do escopo
- Não vou popular figurinhas de exemplo nos usuários de teste (pode ser feito depois se quiser).
- Não vou alterar políticas RLS existentes.

### Arquivos
- `supabase/functions/seed-test-users/index.ts` (novo, temporário)
- Invocação única via curl

Aprovar para prosseguir?