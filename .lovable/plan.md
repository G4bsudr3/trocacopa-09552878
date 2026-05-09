## Objetivo
Garantir que a lista "Perto de Mim" (e o destaque na Home) sempre apareça ordenada primeiro pela compatibilidade de troca e, em caso de empate, pelos colecionadores mais próximos.

## Diagnóstico
A função `nearby_collectors` no banco já retorna `ORDER BY compat_score DESC, distance_km ASC`, mas:
1. O `compat_score` é um número contínuo (combina matches + proximidade), então quase nunca empata — o desempate por distância raramente acontece de verdade.
2. Não há nenhum reordenamento no cliente, então o que vem do banco é o que aparece.
3. Resultado prático: dois usuários com "compatibilidade equivalente" (ex: 12 e 11 figurinhas em comum) podem aparecer com o mais distante na frente porque o score embute a proximidade de forma fraca.

Para o usuário, "igualmente bons" significa **mesmo nível de match real** (mesmas figurinhas que ele precisa + mesmas que ele oferece), não score idêntico.

## Plano

### 1. Atualizar `nearby_collectors` (migration)
Trocar a ordenação final por uma chave de duas etapas:

```text
ORDER BY
  (match_count + reverse_match_count) DESC,   -- compatibilidade real
  distance_km ASC,                            -- desempate: mais próximo primeiro
  compat_score DESC                           -- terceiro critério (fallback)
```

Assim, todo par de colecionadores com o mesmo total de matches (forward + reverse) é desempatado pela distância. O `compat_score` continua sendo retornado e exibido como % de compatibilidade na UI — só deixa de ser a chave primária de ordenação.

### 2. Frontend
Nenhuma mudança de lógica é necessária — `_app.near.tsx` e `_app.home.tsx` apenas consomem a ordem do RPC. Confirmar que continuam sem reordenar no cliente.

## Arquivos
- `supabase/migrations/<nova>.sql` — `CREATE OR REPLACE FUNCTION public.nearby_collectors(...)` com a nova cláusula `ORDER BY` (corpo idêntico ao atual, só muda o final).

## Fora de escopo
- Mudar a fórmula do `compat_score` exibido como porcentagem.
- Filtros novos, paginação, raio.
