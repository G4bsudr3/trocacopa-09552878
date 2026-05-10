# Mapa responsivo no "Perto de Mim"

Adicionar um mapa interativo na rota `/_app/near` que mostra colecionadores próximos, com **clustering** para lidar com várias pessoas no mesmo ponto, mantendo o contato fácil (clique → iniciar troca) e respeitando a Lei Felca.

## O que muda na experiência

- Toggle no topo da página: **Lista** (atual) | **Mapa** (novo). Mantém todos os filtros (raio, mesma cidade, 1-1).
- Mapa ocupa altura responsiva: `h-[60vh]` no mobile, `h-[70vh]` no desktop, dentro do mesmo `max-w-3xl`.
- Marcadores agrupados em **clusters** quando há muitos colecionadores no mesmo bairro/ponto. Número no cluster mostra quantas pessoas; clicar dá zoom até abrir os pinos individuais.
- Clicar num pino abre um **popup card** com avatar, nome, cidade, distância, score, badges (mesma cidade, álbum parecido) e botão **"Iniciar Troca"** (mesma ação de hoje).
- Quando dois ou mais colecionadores estão no mesmo `lat/lng` exato (mesmo prédio/escola), abre uma **lista paginada dentro do popup** ("3 colecionadores aqui") em vez de empilhar pinos invisíveis.
- Marcador "você" centralizado, em destaque, com círculo do raio atual (10/25/50/100 km).
- Sem geolocalização → mostra estado vazio com CTA para `/profile/edit` (igual lista).

## Privacidade e Lei Felca

- **Menores não aparecem no mapa** — o RPC já bloqueia GPS e `discoverable=false` para `kids_mode`. Para menores logados, a aba "Mapa" fica oculta (só lista, sem coordenadas), reforçando o Modo Kids.
- Coordenadas dos outros usuários são **arredondadas com jitter de ~300m** no servidor antes de enviar (precisão suficiente para "perto", evita rastreio exato de residência).
- Popup nunca mostra endereço, só cidade e distância aproximada.

## Mudanças técnicas

### Banco
Nova RPC `match_collectors_geo(_radius_km)`:
- Mesma lógica/colunas do `match_collectors` atual + `lat_approx`, `lng_approx` (arredondados a ~3 casas decimais com jitter determinístico por `id`).
- Só retorna linhas onde o **outro** usuário tem `lat/lng` e é adulto (kids_mode=false). Continua aplicando regra peer-group (adulto-adulto, menor-menor — menores via lista apenas).
- Mesmo SECURITY DEFINER, GRANT a `authenticated`.

### Dependências
- `bun add leaflet react-leaflet supercluster` + `@types/leaflet @types/supercluster`.
- CSS do Leaflet importado em `__root.tsx` ou no componente do mapa (dynamic import).

### Componentes
- Novo `src/components/NearMap.tsx`: encapsula `MapContainer`, tile layer (OpenStreetMap, sem API key), `useSupercluster` para clustering, popups customizados com `glass`/design tokens, círculo de raio. SSR-safe via `lazy()` + `<ClientOnly>` (montar só no cliente — Leaflet usa `window`).
- `src/components/NearPopupCard.tsx`: card reutilizável dentro do popup, recebe `NearbyRow` + `onStartTrade`. Lista múltiplos quando o cluster é "spiderfied" no mesmo ponto.

### Rota
- `src/routes/_app.near.tsx`: adicionar estado `view: 'list' | 'map'`, toggle, render condicional. Reaproveita `nearby` query (chama nova RPC). `startTrade` permanece igual.
- Esconder toggle "Mapa" se `profile.kids_mode === true`.

### Tema
- Estilos do Leaflet sobrescritos em `src/styles.css` para casar com o design (popup glass, controles de zoom com border radius, marcadores em SVG inline com cor `--primary`).

## Fora do escopo

- Geocoding reverso (mostrar bairro).
- Heatmap.
- Filtro por desenho de área no mapa.
- Tiles offline / dark map customizado (usaremos OSM padrão; podemos trocar depois).

## Verificação

Após implementar: abrir `/near`, alternar para Mapa, conferir clusters expandindo no zoom, popup abrindo com botão "Iniciar Troca" funcionando, comportamento responsivo em mobile/desktop, e que conta de menor não vê a aba Mapa.
