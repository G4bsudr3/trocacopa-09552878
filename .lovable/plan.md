## Ajuste do total de figurinhas (864 → 980)

A constante `TOTAL_STICKERS` em `src/lib/stickers.ts` está com 864 e é usada em Home, Álbum e Perfil para mostrar progresso, "Faltam" e %. O álbum oficial tem 980 figurinhas (68 especiais já inclusas nesse total).

### Mudança
- `src/lib/stickers.ts`: `TOTAL_STICKERS = 864` → `TOTAL_STICKERS = 980`.

Isso corrige automaticamente:
- Home (`_app.home.tsx`): contagem "X / 980", faltam e %
- Álbum (`_app.album.tsx`): card "Total" e barra de progresso
- Perfil (`_app.profile.tsx`): % do álbum

A tela de admin já usa `TARGET_TOTAL = 980`, então fica consistente.

Nenhuma mudança de banco é necessária — a tabela `stickers` já tem 980 linhas.