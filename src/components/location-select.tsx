import { useEffect, useState, useMemo, useRef } from "react";
import { MapPin, Loader2, ChevronDown, Search, X, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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
  const initial = useMemo(() => parseLocation(value), []);
  const [uf, setUf] = useState(initial.uf);
  const [city, setCity] = useState(initial.city);
  const [ufs, setUfs] = useState<UF[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingUF, setLoadingUF] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [ufOpen, setUfOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [ufSearch, setUfSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const citySearchRef = useRef<HTMLInputElement>(null);
  const ufSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadingUF(true);
    fetchUFs()
      .then(setUfs)
      .catch(() => setUfs([]))
      .finally(() => setLoadingUF(false));
  }, []);

  useEffect(() => {
    if (!uf) { setCities([]); return; }
    setLoadingCity(true);
    fetchCities(uf)
      .then((list) => setCities(list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => setCities([]))
      .finally(() => setLoadingCity(false));
  }, [uf]);

  const filteredUfs = useMemo(() => {
    const q = ufSearch.toLowerCase();
    return ufs.filter((u) =>
      u.sigla.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q)
    );
  }, [ufs, ufSearch]);

  const filteredCities = useMemo(() => {
    const q = citySearch.toLowerCase();
    return cities.filter((c) => c.nome.toLowerCase().includes(q));
  }, [cities, citySearch]);

  const selectUf = (sigla: string) => {
    setUf(sigla);
    setCity("");
    onChange(formatLocation("", sigla));
    setUfOpen(false);
    setUfSearch("");
  };

  const selectCity = (nome: string) => {
    setCity(nome);
    onChange(formatLocation(nome, uf));
    setCityOpen(false);
    setCitySearch("");
  };

  const fieldCls = `flex items-center gap-2 bg-input rounded-2xl px-3 py-3 border transition cursor-pointer active:scale-[0.98] ${
    error ? "border-destructive" : "border-transparent"
  }`;

  return (
    <div>
      <div className={compact ? "grid grid-cols-[110px_1fr] gap-2" : "grid grid-cols-[120px_1fr] gap-2"}>
        {/* Estado */}
        <button
          type="button"
          onClick={() => { setUfOpen(true); setTimeout(() => ufSearchRef.current?.focus(), 100); }}
          className={fieldCls}
        >
          <MapPin size={16} className="text-muted-foreground shrink-0" />
          <span className={`flex-1 text-sm text-left truncate ${uf ? "text-foreground" : "text-muted-foreground"}`}>
            {loadingUF ? "" : uf || "Estado"}
          </span>
          {loadingUF
            ? <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />
            : <ChevronDown size={12} className="text-muted-foreground shrink-0" />
          }
        </button>

        {/* Cidade */}
        <button
          type="button"
          onClick={() => {
            if (!uf) return;
            setCityOpen(true);
            setTimeout(() => citySearchRef.current?.focus(), 100);
          }}
          disabled={!uf}
          className={`${fieldCls} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className={`flex-1 text-sm text-left truncate ${city ? "text-foreground" : "text-muted-foreground"}`}>
            {loadingCity ? "Carregando..." : city || (uf ? "Cidade" : "Selecione o estado")}
          </span>
          {loadingCity
            ? <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />
            : <ChevronDown size={12} className="text-muted-foreground shrink-0" />
          }
        </button>
      </div>

      {error && <p className="text-xs text-destructive mt-1 ml-2">{error}</p>}

      {/* Drawer — Estado */}
      <Drawer open={ufOpen} onOpenChange={setUfOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle>Selecione o estado</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-input rounded-full px-4 py-2.5 border border-transparent focus-within:border-primary">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={ufSearchRef}
                value={ufSearch}
                onChange={(e) => setUfSearch(e.target.value)}
                placeholder="Buscar estado..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              {ufSearch && (
                <button onClick={() => setUfSearch("")} className="text-muted-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto px-4 pb-8">
            {filteredUfs.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum estado encontrado</p>
            )}
            {filteredUfs.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUf(u.sigla)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-surface active:bg-surface/80 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
                    {u.sigla}
                  </span>
                  <span className="text-sm">{u.nome}</span>
                </div>
                {uf === u.sigla && <Check size={16} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Drawer — Cidade */}
      <Drawer open={cityOpen} onOpenChange={setCityOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-0">
            <DrawerTitle>Selecione a cidade — {uf}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-input rounded-full px-4 py-2.5 border border-transparent focus-within:border-primary">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={citySearchRef}
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Buscar cidade..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              {citySearch && (
                <button onClick={() => setCitySearch("")} className="text-muted-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto px-4 pb-8">
            {loadingCity && (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            )}
            {!loadingCity && filteredCities.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma cidade encontrada</p>
            )}
            {!loadingCity && filteredCities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCity(c.nome)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-surface active:bg-surface/80 transition text-left"
              >
                <span className="text-sm">{c.nome}</span>
                {city === c.nome && <Check size={16} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
