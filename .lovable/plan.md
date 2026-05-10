## Resumo

Adicionar dois recursos:

1. **Convidar amigo por QR Code / link** — no Perfil, gera um QR e link de convite único do usuário. Quem entra pelo link já é cadastrado como "amigo" (match automático), aparece destacado em Perto/Trocas e enxerga as figurinhas (tem/repetidas/falta) do outro.
2. **Marcar encontro para troca** — dentro da tela da troca, botão "Marcar encontro" que abre um seletor simples (data + horário + local) e grava na troca. Os dois veem o combinado, podem confirmar, remarcar ou cancelar. Notificação automática quando algo muda.

## O que será criado / alterado

### Banco de dados (migração)

- Nova tabela `friendships` (`user_a`, `user_b`, `created_at`, `source`) com par único e RLS para que cada usuário leia apenas suas relações.
- Nova tabela `invites` (`id`, `inviter_id`, `code` único curto, `created_at`, `accepted_by`, `accepted_at`). RLS: dono lê/cria os seus; qualquer autenticado pode validar pelo `code` via função `accept_invite(_code)` `SECURITY DEFINER` que cria a `friendship`, marca o invite e dispara notificação.
- Adicionar em `trades`: `meet_at timestamptz`, `meet_place text`, `meet_status` (`proposed|confirmed|cancelled`), `meet_proposed_by uuid`. Trigger de notificação quando `meet_*` muda.

### Frontend

- **`src/routes/_app.profile.tsx`**: novo card "Convidar amigo" → abre sheet com QR Code (lib `qrcode.react`) + link copiável + botão de compartilhar nativo (`navigator.share`). Mostra contador de amigos convidados.
- **Nova rota `src/routes/invite.$code.tsx`** (pública): se logado, chama `accept_invite` e redireciona para o perfil do convidador; se não logado, salva o code em `localStorage`, manda para `/login`, e após signup/login consome.
- **`src/lib/auth.tsx`** ou listener no `_app.tsx`: ao logar com `pendingInvite`, executa `accept_invite` e limpa.
- **`src/routes/_app.near.tsx`** e **`_app.trades.tsx`**: badge "Amigo" para perfis com `friendship` ativa; seção "Meus amigos" no topo de Perto.
- **`src/routes/_app.trade.$id.tsx`**: novo bloco "Encontro" com botão "Marcar/Editar encontro" → dialog com `Calendar` (shadcn) + input de horário + input de local. Mostra resumo "Sáb 17/05 às 15h00 — Praça da Sé" com botões Confirmar / Remarcar / Cancelar.

### Dependências

- `bun add qrcode.react` (QR Code)
- `date-fns` já presente para formatação

## Fluxos

```text
Convidar amigo:
Perfil → "Convidar amigo" → QR + link /invite/abc123
   → amigo abre link → login/signup → accept_invite(abc123)
   → friendship criada → notificação "Você e Fulano agora são amigos"
   → ambos se enxergam destacados em Perto/Trocas

Marcar troca:
Trade → "Marcar encontro" → data/hora/local → salva proposed
   → outro recebe notif → Confirmar/Remarcar
   → vira confirmed; ao concluir a troca, status volta normal
```

## Pontos de confirmação

- O convite deve gerar **match automático sempre** (amigo) ou só **destaque sem virar amizade obrigatória**? — proponho criar amizade automática, mais simples.
- Local do encontro: texto livre ou usar lista de pontos sugeridos? — proponho texto livre por simplicidade.
