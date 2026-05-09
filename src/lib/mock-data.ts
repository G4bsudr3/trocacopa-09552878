// Stickers 1..640 for World Cup 2026
export const TOTAL_STICKERS = 640;

const teams = [
  "Brasil", "Argentina", "França", "Alemanha", "Espanha", "Inglaterra",
  "Portugal", "Holanda", "Itália", "Croácia", "Uruguai", "México",
  "EUA", "Canadá", "Japão", "Coreia do Sul",
];

const playerNames = [
  "Vinicius Jr.", "Rodrygo", "Endrick", "Casemiro", "Alisson", "Marquinhos",
  "Messi", "Di María", "Lautaro", "Mbappé", "Griezmann", "Dembélé",
  "Musiala", "Wirtz", "Kane", "Bellingham", "Foden", "Saka",
  "Pedri", "Yamal", "Rodri", "Ronaldo", "Bruno Fernandes", "Leão",
];

function rng(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export type Sticker = {
  number: number;
  name: string;
  team: string;
  group: string;
  owned: boolean;
  duplicates: number;
};

export function generateStickers(): Sticker[] {
  return Array.from({ length: TOTAL_STICKERS }, (_, i) => {
    const num = i + 1;
    const r = rng(num);
    const r2 = rng(num + 999);
    const owned = r > 0.53;
    const duplicates = owned && r2 > 0.7 ? Math.floor(r2 * 4) + 1 : 0;
    return {
      number: num,
      name: playerNames[num % playerNames.length],
      team: teams[num % teams.length],
      group: String.fromCharCode(65 + (num % 12)),
      owned,
      duplicates,
    };
  });
}

export type Collector = {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  match: number;
  has: number[];
  needs: number[];
  avatar: string;
  lat: number;
  lng: number;
};

export const mockCollectors: Collector[] = [
  { id: "1", name: "João Silva", city: "São Paulo", distanceKm: 1.2, match: 92, has: [12, 47, 203], needs: [88, 156], avatar: "JS", lat: -23.55, lng: -46.63 },
  { id: "2", name: "Maria Souza", city: "São Paulo", distanceKm: 2.4, match: 87, has: [88, 301, 412], needs: [12, 47], avatar: "MS", lat: -23.56, lng: -46.65 },
  { id: "3", name: "Pedro Lima", city: "São Paulo", distanceKm: 3.8, match: 76, has: [156, 230, 488], needs: [203, 412], avatar: "PL", lat: -23.54, lng: -46.62 },
  { id: "4", name: "Ana Costa", city: "São Paulo", distanceKm: 5.1, match: 68, has: [77, 199, 555], needs: [301, 488], avatar: "AC", lat: -23.57, lng: -46.61 },
  { id: "5", name: "Lucas Rocha", city: "São Paulo", distanceKm: 6.7, match: 54, has: [333, 444, 600], needs: [555, 199], avatar: "LR", lat: -23.53, lng: -46.66 },
];

export const mockNotifications = [
  { id: "1", icon: "⚽", text: "João quer trocar com você!", time: "agora", unread: true },
  { id: "2", icon: "🔍", text: "Encontramos alguém com a figurinha #203 perto de você", time: "5min", unread: true },
  { id: "3", icon: "✅", text: "Sua troca com Maria foi confirmada", time: "1h", unread: false },
  { id: "4", icon: "🏆", text: "Você completou 50% do álbum!", time: "ontem", unread: false },
];
