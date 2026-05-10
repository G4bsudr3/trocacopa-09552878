## Objetivo

Replicar a lógica progressiva 0→1→2→+1 (mesma do álbum) na tela **Escanear**, que hoje exige escolher manualmente entre dois botões "Tenho" / "Repetida" — fora do padrão.

## Onde já existe

- `src/routes/_app.album.tsx` (linhas 62-73) — `onCellTap` faz: 1º toque marca, 2º vira repetida, 3º+ incrementa.
- `src/routes/_app.duplicates.tsx` — botões +/- explícitos (faz sentido: tela dedicada a ajustar contagem).

## Tela a ajustar: `src/routes/_app.scan.tsx`

Substituir a função `register(code, asDup)` por uma única `registerProgressive(code)`:

```ts
const registerProgressive = (code: string) => {
  const cur = stickers.find((s) => s.code === code);
  if (!cur || !cur.owned) {
    toggleOwned(code);
    toast.success(`${code} adicionada ao álbum ✅`);
  } else {
    addDuplicate(code);
    const next = cur.duplicates + 1;
    toast.success(
      next === 2 ? `${code} agora é repetida (2x) 🔁` : `${code} +1 repetida (${next}x)`,
    );
  }
  setRecent(...); setQuery(""); setPreview(null); setResult(null);
};
```

Atualizar os 3 lugares de UI:

1. **Resultado do scan** (linhas 242-260): trocar os 2 botões por **um único botão CTA grande** que mostra o estado atual:
   - 0 dups: "✅ Tenho" (gradient-primary)
   - 1+ dups: "🔁 +1 Repetida (próx: Nx)" (gold)
   - Texto dinâmico baseado em `dup`.

2. **Suggestions list** (linha 339): já usa um único `register(s.code, false)` — trocar pelo `registerProgressive`. Sem mudança visual.

3. **Recents list** (linhas 409-425): trocar os 2 botões pelo mesmo CTA único progressivo, com label dinâmico ("Tenho" ou "+1 Rep. (Nx)").

## Arquivo afetado

- `src/routes/_app.scan.tsx` — apenas a função `register` e os 3 trechos de UI acima. Sem mudanças em dados, schema ou outros arquivos.
