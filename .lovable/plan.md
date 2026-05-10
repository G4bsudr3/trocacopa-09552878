# Guardar uploads de fotos para reuso como exemplo no álbum

Salvar todas as imagens enviadas pelos usuários (avatar e scan de figurinha) num bucket privado, com **opt-in claro** por upload. Sem painel de curadoria agora — você acessa o bucket depois para escolher quais virar exemplo oficial.

## O que muda na experiência

### No upload de avatar (`/profile/edit`)
- Após escolher a foto, aparece um checkbox: **"Permitir que minha foto seja usada como inspiração no app (opcional)"**.
- Se marcado: além de salvar como avatar, copiamos a foto para a galeria interna.
- Texto pequeno: "Você pode revogar a qualquer momento nas configurações."
- Bloqueado para menores (`kids_mode=true`) — checkbox nem aparece, foto nunca vai pra galeria.

### No scanner (`/scan`)
- Depois que o scan reconhece uma figurinha, aparece um card discreto: **"📸 Sua foto ficou boa? Doe como exemplo desta figurinha"** + botão "Sim, doar" / "Não".
- Se "Sim, doar": envia a imagem pro bucket marcando a `sticker_code` reconhecida.
- Bloqueado para menores.
- Sem check = foto nem é enviada (segue o comportamento atual: scan local/edge function, não persiste).

### Em Configurações
- Nova seção **"Minhas contribuições"**: lista quantas fotos você doou + botão "Apagar todas as minhas contribuições" (LGPD).

## Backend

### Bucket
- Novo bucket privado `user-contributions`. Não é público (só admin via service role lê/lista, usuário só insere o próprio).
- Estrutura: `user-contributions/{user_id}/{kind}/{timestamp}-{uuid}.jpg`
  - `kind` ∈ `avatar` | `sticker`
- RLS via storage policies:
  - INSERT: usuário autenticado pode inserir só dentro de `auth.uid()/...` E onde a profile dele tenha `kids_mode=false`.
  - SELECT/DELETE: dono pode ver/apagar os seus; admin (`has_role`) lê todos.

### Tabela `user_contributions` (metadados)
Colunas: `id`, `user_id`, `kind` (avatar/sticker), `storage_path`, `sticker_code` (nullable), `consent_at`, `status` (pending/approved/rejected/used), `reviewed_by`, `reviewed_at`, `created_at`.
- RLS:
  - INSERT: `auth.uid() = user_id` e perfil não kids_mode (checado via subquery).
  - SELECT: dono OR admin.
  - DELETE: dono OR admin.
  - UPDATE: só admin (mudar `status`).
- Default `status = 'pending'`.

### Função `mark_contribution_used` (admin)
SECURITY DEFINER: dado `contribution_id`, copia o storage object para `sticker-images/{sticker_code}.jpg`, atualiza `stickers.image_url`, marca contribuição como `used`. (Para uso futuro pelo painel admin.)

## Frontend — arquivos

- `src/routes/_app.profile.edit.tsx`: adicionar checkbox de consentimento, ao salvar avatar (se marcado) também enviar para `user-contributions/{uid}/avatar/...` e inserir linha em `user_contributions`. Esconder checkbox se `kids_mode`.
- `src/routes/_app.scan.tsx`: depois de `setResult(...)`, mostrar bloco "Doar foto como exemplo". Botão chama um helper `donateScanPhoto(file, sticker_code)`.
- `src/lib/contributions.ts`: helpers `uploadContribution(file, kind, sticker_code?)` (upload + insert metadata) e `deleteMyContributions()`.
- `src/routes/_app.settings.tsx`: nova seção com count + botão apagar.
- `src/routes/seguranca.tsx`: parágrafo curto explicando que doações são opt-in, podem ser apagadas, e menores nunca doam.

## Privacidade / Lei Felca

- Trigger `enforce_age_and_kids_mode` já garante `kids_mode=true` para <18. A política de INSERT do bucket e da tabela vai checar isso, então mesmo que o front falhe em esconder o botão, o servidor recusa.
- Foto guardada nunca é exibida publicamente sem o admin marcar `status='used'`.
- "Apagar todas as minhas contribuições" remove os arquivos do storage e as linhas da tabela.

## Fora do escopo

- Painel admin de curadoria (próxima fase — você lê o bucket direto por enquanto).
- Detecção automática de qualidade da foto.
- Watermark/atribuição.
- Notificação ao usuário quando a foto dele virar exemplo oficial.

## Verificação

Subir avatar com checkbox marcado → conferir que apareceu no bucket `user-contributions/{uid}/avatar/`. Escanear figurinha e clicar "Doar" → conferir registro com `sticker_code` correto. Tentar doar logado como menor → deve falhar pelo RLS.
