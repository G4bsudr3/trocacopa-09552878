import { useEffect, useState, useMemo } from "react";
import { MapPin, Loader2, ChevronDown } from "lucide-react";

type UF = { id: number; sigla: string; nome: string };
type City = { id: number; nome: string };

let ufCache: UF[] | null = null;
const cityCache = new Map<string, City[]>();

async function fetchUFs(): Promise<UF[]> {
  if (ufCache) return ufCache;
  const r = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  const data: UF[] = await r.json();
  ufCache = data;
  return data;
}

async function fetchCities(uf: string): Promise<City[]> {
  if (cityCache.has(uf)) return cityCache.get(uf)!;
  const r = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );
  const data: City[] = await r.json();
  cityCache.set(uf, data);
  return data;
}

export function parseLocation(value: string): { city: string; uf: string } {
  if (!value) return { city: "", uf: "" };
  const m = value.match(/^(.*?)[\s]*[\/,-][\s]*([A-Z]{2})$/);
  if (m) return { city: m[1].trim(), uf: m[2].trim().toUpperCase() };
  return { city: value, uf: "" };
}

export function formatLocation(city: string, uf: string): string {
  if (city && uf) return `${city}/${uf}`;
  return city || "";
}

export function LocationSelect({
  value,
  onChange,
  error,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  compact?: boolean;
}) {
  const initial = useMemo(() => parseLocation(value), [value]);
  const [uf, setUf] = useState(initial.uf);
  const [city, setCity] = useState(initial.city);
  const [ufs, setUfs] = useState<UF[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingUF, setLoadingUF] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);

  useEffect(() => {
    setLoadingUF(true);
    fetchUFs()
      .then(setUfs)
      .catch(() => setUfs([]))
      .finally(() => setLoadingUF(false));
  }, []);

  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }
    setLoadingCity(true);
    fetchCities(uf)
      .then((list) => setCities(list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => setCities([]))
      .finally(() => setLoadingCity(false));
  }, [uf]);

  const update = (newCity: string, newUf: string) => {
    setCity(newCity);
    setUf(newUf);
    onChange(formatLocation(newCity, newUf));
  };

  const baseField = `flex items-center gap-2 bg-input rounded-2xl px-3 py-3 border transition ${
    error ? "border-destructive" : "border-transparent focus-within:border-primary"
  }`;

  return (
    <div>
      <div className={compact ? "grid grid-cols-[110px_1fr] gap-2" : "grid grid-cols-[120px_1fr] gap-2"}>
        <div className={baseField}>
          <MapPin size={16} className="text-muted-foreground shrink-0" />
          <div className="relative flex-1">
            <select
              value={uf}
              onChange={(e) => update("", e.target.value)}
              disabled={loadingUF}
              className="w-full appearance-none bg-transparent outline-none text-sm pr-5 cursor-pointer"
            >
              <option value="">UF</option>
              {ufs.map((u) => (
                <option key={u.id} value={u.sigla}>
                  {u.sigla}
                </option>
              ))}
            </select>
            {loadingUF ? (
              <Loader2 size={12} className="animate-spin absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
            ) : (
              <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            )}
          </div>
        </div>

        <div className={baseField}>
          <div className="relative flex-1">
            <select
              value={city}
              onChange={(e) => update(e.target.value, uf)}
              disabled={!uf || loadingCity}
              className="w-full appearance-none bg-transparent outline-none text-sm pr-5 cursor-pointer disabled:opacity-50"
            >
              <option value="">{!uf ? "Selecione o estado" : loadingCity ? "Carregando..." : "Cidade"}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
            {loadingCity ? (
              <Loader2 size={12} className="animate-spin absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
            ) : (
              <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-destructive mt-1 ml-2">{error}</p>}
    </div>
  );
}
