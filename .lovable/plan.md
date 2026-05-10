## Tela "Minhas Repetidas"

Nova rota dedicada para o usuário ver e gerenciar de forma rápida todas as figurinhas que tem em duplicata (>1), com visual alinhado ao álbum (glass + gold accents).

### Rota
- Criar `src/routes/_app.duplicates.tsx` em `/duplicates`.

### Layout
- Header com título "Minhas Repetidas" + subtítulo com contagem total ("X figurinhas · Y trocáveis").
- Hero card (glass-strong) com 3 stats: Únicas repetidas, Total de excedentes (sum duplicates-1), Países envolvidos.
- Filtros em chips: Todas / Por país / Especiais.
- Busca por código/país (igual ao álbum).
- Lista agrupada por país (collapsível) ou grid (toggle).
- Cada cell mostra a figurinha (image_url, owned styling), badge dourado "Nx" e controles inline `−`  qty  `+` para ajustar repetidas direto, sem precisar abrir sheet.
- CTA fixo no rodapé (acima do BottomNav): "Encontrar trocas com essas" → leva para `/near` (já existe).
- Empty state amigável quando não houver repetidas: ilustração ⚽ + texto + botão "Ir ao álbum".

### Acesso
- Adicionar atalho na home (`_app.home.tsx`) e/ou no perfil para a nova tela.
- Adicionar link/quick-action no header do álbum atual (`_app.album.tsx`) tipo chip "Ver repetidas".

### Dados
- Reusa `useAlbum()` (já tem `stickers`, `addDuplicate`, `removeDuplicate`, `setSticker`).
- Filtra `stickers.filter(s => s.duplicates > 1)`.

### Detalhes técnicos
- Usar tokens do design system (glass, glass-strong, gold, primary, gradient-primary).
- Animações com framer-motion (entrada em stagger).
- Sem mudanças no schema/Supabase.

Quer que eu inclua também um botão "Marcar todas como trocadas" (zera repetidas em massa) ou deixa só ajuste individual?