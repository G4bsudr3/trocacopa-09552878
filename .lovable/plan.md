## Diagnóstico

Revisei o fluxo de cadastro/login (`src/routes/login.tsx`), o provider de auth (`src/lib/auth.tsx`), o layout protegido (`src/routes/_app.tsx`), o trigger `handle_new_user` no banco e a edição de perfil (`src/routes/_app.profile.edit.tsx`).

**O que está funcionando bem**
- Trigger `on_auth_user_created` cria automaticamente uma linha em `profiles` a partir de `raw_user_meta_data.full_name` (5 usuários atuais → 5 profiles, sem órfãos).
- `AuthProvider` instala `onAuthStateChange` antes de `getSession()` (ordem correta) e usa `setTimeout(fetchProfile, 0)` para evitar deadlock.
- RLS bem definida em `profiles`, `user_stickers`, `trades`, `notifications`, `user_roles` (com `has_role` SECURITY DEFINER).
- Storage `avatars` tem políticas por owner.
- Google OAuth via `lovable.auth` configurado.

**Problemas reais encontrados**

1. **Cadastro quebra silenciosamente quando confirmação de e-mail está ativa** (caso padrão da Lovable Cloud). Após `signUp()`, não há `session`; o `upsert` em `profiles` falha por RLS (`auth.uid()` é null), o toast "Conta criada!" é exibido e o `navigate("/home")` redireciona de volta para `/login` — o usuário fica perdido sem entender que precisa confirmar o e-mail.

2. **Cidade do cadastro pode ser perdida**: a `city` digitada no signup é gravada via `upsert` cliente; quando há confirmação de e-mail esse `upsert` falha. O trigger só salva `full_name`, então o perfil novo nasce sem cidade.

3. **Sem validação de entrada** no `LoginPage`. Senhas vazias/curtas, e-mails inválidos e nomes vazios chegam direto ao Supabase. Já usamos Zod em `_app.profile.edit.tsx`; padrão a seguir.

4. **Sem fluxo "esqueci minha senha"** — usuário sem acesso fica preso.

5. **Mensagens de erro do Supabase em inglês** (`Invalid login credentials`, etc.) chegam cruas no toast. Pequena tradução melhora muito a UX.

6. **Privacidade do perfil**: a policy `Profiles are viewable by authenticated users` expõe `lat`, `lng`, `bio` de qualquer usuário autenticado. (Sinalizo, mas só corrijo se você quiser — não é bloqueante para o cadastro funcionar.)

## Plano

### 1. `src/routes/login.tsx` — robustecer signup/signin

- Adicionar schema Zod:
  - `email`: `.email()`, max 255
  - `password`: min 8, max 72
  - `name` (signup): min 2, max 80
  - `city` (signup): min 2, max 80
- Validar antes de chamar Supabase; mostrar erro inline por campo.
- **Passar `city` no `raw_user_meta_data`** (`data: { full_name, city }`) para que o trigger consiga aproveitar (ver item 2).
- **Após `signUp` checar `data.session`**:
  - Se `session` existe (auto-confirm ligado) → toast sucesso + `navigate("/home")`.
  - Se `session` é `null` → toast info "Enviamos um e-mail de confirmação para {email}. Confirme para entrar.", limpar campos, voltar para modo `signin`. Não navegar.
- Se `data.session` existe, fazer um `update` (não `upsert`) em `profiles` para complementar `city` — somente como fallback, pois o trigger atualizado já cobre.
- Tratar mensagens de erro mais comuns:
  - `Invalid login credentials` → "E-mail ou senha incorretos"
  - `User already registered` → "Este e-mail já tem cadastro — faça login"
  - `Email not confirmed` → "Confirme seu e-mail antes de entrar"
- Adicionar link "Esqueci minha senha" (só no modo `signin`) que abre um pequeno dialog/inline form para `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.

### 2. Migration: trigger `handle_new_user` lê `city` também

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
INSERT INTO public.profiles (id, full_name, city, avatar_url) VALUES (
  new.id,
  coalesce(meta->>'full_name', meta->>'name', split_part(email,'@',1)),
  meta->>'city',
  meta->>'avatar_url'
) ON CONFLICT (id) DO NOTHING;
```

Garante que cidade do formulário de signup seja persistida sempre, independente de confirmação de e-mail ou da segunda chamada falhar.

### 3. Nova rota `src/routes/reset-password.tsx`

- Rota pública (fora de `/_app`).
- Detecta hash `type=recovery` (ou apenas confia que `onAuthStateChange` emitiu `PASSWORD_RECOVERY`).
- Form com nova senha (Zod min 8) + confirmação.
- Chama `supabase.auth.updateUser({ password })`.
- Sucesso → toast + `navigate("/login")`.

### 4. Pequena melhora em `src/lib/auth.tsx`

- Tratar `PASSWORD_RECOVERY` event (não navegar para `/home` automaticamente nesse caso — deixar a rota `/reset-password` processar).
- Garantir que quando `signOut` é chamado, `profile` é limpo (já é via listener, mas confirmar).

## Itens fora do escopo (mencionados, não implementados)

- **Privacidade**: criar view `profiles_public` sem `lat/lng/bio` ou alterar policy de SELECT para excluir esses campos. Posso fazer numa próxima rodada se você quiser.
- **HIBP** (Have I Been Pwned) check para senhas — posso ativar via `configure_auth` se quiser bloquear senhas vazadas.
- Não vou habilitar auto-confirm de e-mail (segue padrão recomendado).

## Arquivos

- `src/routes/login.tsx` (refator)
- `src/routes/reset-password.tsx` (novo)
- `src/lib/auth.tsx` (ajuste pequeno)
- migration: atualiza `public.handle_new_user`
