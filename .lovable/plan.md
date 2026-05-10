
# Adequação à Lei Felca (ECA Digital) — TrocaCopa

Plano para deixar o app conforme a Lei nº 15.211/2025, com foco em proteger as crianças que vão colecionar figurinhas da Copa, mantendo a experiência leve e divertida.

## Visão geral da experiência

```text
Cadastro → pede data de nascimento → classifica em 3 trilhas:

  ≥18 anos        ADULTO            Acesso completo
  13 a 17 anos    ADOLESCENTE       Modo Kids automático + consentimento
                                    do responsável (e-mail)
  <13 anos        CRIANÇA           Conta supervisionada: criada em nome
                                    do responsável, kid usa um "perfil filho"
```

Tudo é apresentado com linguagem amigável (mascotes, emojis de bola, cores quentes), sem jargões jurídicos visíveis para a criança. Avisos legais ficam no rodapé / página dedicada.

## 1. Banco de dados (migration)

Adicionar à tabela `profiles`:

- `birth_date` (date) — data de nascimento
- `age_group` (enum `child` | `teen` | `adult`) — calculado e materializado
- `guardian_email` (text) — e-mail do responsável (obrigatório se `child`/`teen`)
- `guardian_consent_at` (timestamptz) — quando o responsável aprovou
- `guardian_user_id` (uuid) — para conta supervisionada (<13), aponta para o adulto que tutela
- `kids_mode` (boolean, default true quando `age_group<>'adult'`) — privacidade reforçada
- Trigger que recalcula `age_group` e força `discoverable=false`, `lat=null`, `lng=null`, `bio=null` enquanto `kids_mode = true`

Nova tabela `guardian_consents`:
- `id`, `minor_user_id`, `guardian_email`, `token` (uuid único), `requested_at`, `approved_at`, `expires_at`, `revoked_at`

Nova tabela `content_reports`:
- `id`, `reporter_id`, `target_type` (`user` | `trade` | `message`), `target_id`, `reason` (enum), `details` (text), `status` (`open`/`reviewed`/`actioned`), `created_at`

Atualizar `handle_new_user()` para gravar `birth_date`, `age_group`, `guardian_email` vindos do `raw_user_meta_data`.

Atualizar funções `match_collectors` e `nearby_collectors`:
- Se o usuário logado é menor → só retorna outros menores (`age_group <> 'adult'`)
- Se o usuário logado é adulto → só retorna adultos (não devolve menores na busca)
- Nunca expõe `lat`, `lng`, `birth_date` exatos via SELECT em `profiles` para terceiros (criar VIEW pública `profiles_public` sem campos sensíveis e ajustar policies)

## 2. Cadastro com verificação de idade

Tela `/login` (modo signup) ganha campo **Data de nascimento** com validação Zod. Fluxo após preencher:

- **≥18**: cadastro normal, segue para `/home`
- **13–17**: pede também **e-mail do responsável** → cria conta, mas marca como "pendente de consentimento" → bloqueia trocas e Perto até o responsável aprovar → mostra tela "Aguardando o OK do responsável"
- **<13**: tela explicativa "Para usar o TrocaCopa precisamos do seu pai, mãe ou responsável" → coleta nome+e-mail do responsável → cria conta supervisionada (registro do responsável + perfil filho vinculado por `guardian_user_id`)

## 3. Consentimento parental (e-mail)

- Server function `requestGuardianConsent` gera token e dispara e-mail (via Lovable Cloud / Resend ou edge function existente) com link `/consent/:token`
- Rota pública `/consent/:token` mostra: dados do menor, o que o app faz, e botões "Autorizo" / "Não autorizo"
- Aprovação: marca `guardian_consent_at`, libera o app para o menor
- E-mail também explica direitos do responsável (revogar a qualquer momento, solicitar exclusão)

## 4. Modo Kids (privacidade por padrão)

Quando `kids_mode=true` (ligado para todos <18):

- `discoverable` forçado em `false`, sem aparecer em listas públicas
- Coordenadas GPS bloqueadas no servidor (mostra apenas cidade/estado, nunca lat/lng exatas)
- Bio escondida para terceiros
- Mensagens de troca passam por filtro de palavrões/conteúdo impróprio (lista local + opcional Lovable AI moderation)
- Banner permanente discreto: "Modo Kids ativo 🛡️"
- Trocas filtradas para outros menores apenas (em `match_collectors` e na busca de Perto)
- Botão "Combine sempre com um responsável" em todo card de troca

Configurações do menor ficam **bloqueadas** (não pode desligar Modo Kids, nem virar discoverable, nem cadastrar localização precisa). Só o responsável pode mexer (na tela de gestão da conta filho).

## 5. Conta supervisionada (<13)

- Responsável faz login com a própria conta (adulto)
- Em `/profile` ganha aba "Meus filhos" com lista de perfis supervisionados
- Pode trocar de perfil (switcher) e operar em nome do filho — toda ação fica logada como sendo do responsável
- Pode pausar, exportar dados ou excluir o perfil filho a qualquer momento

## 6. Moderação e canal de denúncia

- Botão **"Denunciar"** (ícone bandeira) em: card de usuário (Perto/Ranking), tela de troca, mensagem de chat
- Modal com motivos pré-definidos: "Linguagem imprópria", "Comportamento estranho", "Pediu informação pessoal", "Conteúdo adulto", "Outro"
- Server function `submitReport` grava em `content_reports`
- Filtro automático em `trade_messages`: lista de palavras proibidas no servidor; mensagem suspeita é bloqueada e gera report automático
- Painel admin `/admin/reports` (já temos área admin) para revisar e tomar ação (suspender, alertar, ignorar)

## 7. Backfill dos usuários existentes

Os 5 usuários atuais não têm `birth_date`. No próximo login:

- Componente `<AgeGate />` em `_app.tsx` detecta `birth_date IS NULL` e exibe **modal bloqueante** (não fecha) pedindo data de nascimento
- Mesma lógica do cadastro: classifica e, se menor, pede e-mail do responsável e segura o app até consentimento
- Sem data preenchida = sem acesso a trocas, Perto e chat

## 8. Páginas legais e transparência

- Nova rota `/seguranca` (link no rodapé e no footer do `/login`):
  - Resumo da Lei Felca em linguagem simples
  - O que coletamos, por quê, e como protegemos crianças
  - Como o responsável pede exclusão de dados (`suporte@trocacopa.com`)
  - Canal de denúncia
- Rota `/privacidade` complementar (texto resumido)
- Selo "Conformidade ECA Digital 🛡️" no rodapé

## Arquivos / áreas afetadas

**Migrations**
- nova: campos em `profiles`, tabelas `guardian_consents`, `content_reports`, view `profiles_public`, atualização `handle_new_user`, atualização `match_collectors` e `nearby_collectors`

**Frontend**
- `src/routes/login.tsx` — campos de DOB, e-mail responsável, fluxo por faixa etária
- `src/routes/_app.tsx` — `<AgeGate />` para backfill + bloqueio de funções para menores sem consentimento
- `src/routes/_app.profile.edit.tsx` — desabilitar campos sensíveis em Modo Kids; aba "Meus filhos" para responsáveis
- `src/routes/_app.nearby.tsx` e busca — apenas mostra usuários da mesma faixa etária
- `src/routes/_app.scan.tsx` e telas de troca — banner Modo Kids + botão denunciar
- `src/routes/_app.trade.$id.tsx` — filtro de mensagens + denunciar
- nova `src/routes/consent.$token.tsx` — pública, aprovação do responsável
- nova `src/routes/seguranca.tsx` e `src/routes/privacidade.tsx`
- nova `src/routes/_app.admin.reports.tsx` — painel de denúncias
- novos componentes: `KidsModeBadge`, `ReportButton`, `ReportDialog`, `AgeGateDialog`, `GuardianPendingScreen`, `ChildProfileSwitcher`

**Server functions / lib**
- `src/lib/guardian.functions.ts` — request/approve/revoke consent, envio de e-mail
- `src/lib/moderation.functions.ts` — filtro de mensagens, submit report
- `src/lib/age.ts` — helpers `computeAgeGroup`, `requireKidsMode`

## Fora de escopo (fica para fase 2)

- Verificação de idade com documento (CPF/RG do responsável) — começamos com declaração + e-mail
- Integração com gov.br para validar responsável
- Moderação de imagens (foto de perfil) com IA
- Relatório periódico de atividade enviado ao responsável

## Observação sobre "capturar foto"

Entendi como **proteger menores no app**, não tirar fotos de crianças. A câmera atual (scanner) continua igual — ela só processa a figurinha localmente, sem armazenar selfies. Se você quis dizer outra coisa (ex.: foto do responsável segurando documento para comprovar tutela), me avise antes de implementar — isso entraria como verificação reforçada na fase 2.
