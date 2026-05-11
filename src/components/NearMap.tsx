import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";
import { MessageCircle, Globe2, MapPin, BookOpen, Loader2 } from "lucide-react";

export type NearbyGeoRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  distance_km: number | null;
  give_count: number;
  receive_count: number;
  mutual_count: number;
  same_city: boolean;
  score_pct: number;
  compat_album: boolean;
  out_of_radius: boolean;
  lat_approx: number | null;
  lng_approx: number | null;
};

type Props = {
  rows: NearbyGeoRow[];
  myLat: number;
  myLng: number;
  radiusKm: number;
  onStartTrade: (otherId: string) => void;
  loadingTradeId?: string | null;
};

// Custom marker icon (primary gradient pin)
const userIcon = L.divIcon({
  className: "near-marker-self",
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:hsl(var(--primary, 220 90% 60%));border:3px solid white;box-shadow:0 0 0 3px hsl(var(--primary, 220 90% 60%) / 0.35), 0 4px 12px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const collectorIcon = (score: number) =>
  L.divIcon({
    className: "near-marker-collector",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent, var(--primary))));color:white;font-weight:800;font-size:11px;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.35);">${score}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const clusterIcon = (count: number) => {
  const size = count < 10 ? 38 : count < 50 ? 46 : 54;
  return L.divIcon({
    className: "near-marker-cluster",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--primary) / 0.85);color:white;font-weight:800;font-size:14px;border:3px solid white;box-shadow:0 6px 18px rgba(0,0,0,0.4);">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

function ClusteredMarkers({ rows, onStartTrade, loadingTradeId }: { rows: NearbyGeoRow[]; onStartTrade: (id: string) => void; loadingTradeId?: string | null }) {
  const map = useMap();
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const update = () => {
      const b = map.getBounds();
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setZoom(map.getZoom());
    };
    update();
    map.on("moveend", update);
    map.on("zoomend", update);
    return () => {
      map.off("moveend", update);
      map.off("zoomend", update);
    };
  }, [map]);

  const cluster = useMemo(() => {
    const idx = new Supercluster<{ row: NearbyGeoRow }>({ radius: 60, maxZoom: 17 });
    idx.load(
      rows
        .filter((r) => r.lat_approx != null && r.lng_approx != null)
        .map((r) => ({
          type: "Feature" as const,
          properties: { row: r, cluster: false },
          geometry: { type: "Point" as const, coordinates: [r.lng_approx!, r.lat_approx!] },
        })),
    );
    return idx;
  }, [rows]);

  const items = bounds ? cluster.getClusters(bounds, Math.round(zoom)) : [];

  return (
    <>
      {items.map((item) => {
        const [lng, lat] = item.geometry.coordinates;
        const props: any = item.properties;
        if (props.cluster) {
          const count = props.point_count as number;
          // Gather all rows in this cluster for the popup
          const leaves = cluster.getLeaves(props.cluster_id, Infinity, 0);
          const leafRows = leaves.map((l: any) => l.properties.row as NearbyGeoRow);
          return (
            <Marker
              key={`c-${props.cluster_id}`}
              position={[lat, lng]}
              icon={clusterIcon(count)}
              eventHandlers={{
                click: () => {
                  const expansion = cluster.getClusterExpansionZoom(props.cluster_id);
                  if (expansion > zoom) map.setView([lat, lng], Math.min(expansion, 18));
                },
              }}
            >
              <Popup maxWidth={280}>
                <ClusterListPopup rows={leafRows} onStartTrade={onStartTrade} loadingTradeId={loadingTradeId} />
              </Popup>
            </Marker>
          );
        }
        const row = props.row as NearbyGeoRow;
        return (
          <Marker key={row.id} position={[lat, lng]} icon={collectorIcon(row.score_pct)}>
            <Popup maxWidth={260}>
              <CollectorPopup row={row} onStartTrade={onStartTrade} loadingTradeId={loadingTradeId} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function CollectorPopup({ row, onStartTrade, loadingTradeId }: { row: NearbyGeoRow; onStartTrade: (id: string) => void; loadingTradeId?: string | null }) {
  return (
    <div className="min-w-[220px] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0" style={{ background: "hsl(var(--primary))" }}>
          {row.avatar_url ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" /> : (row.full_name?.[0] || "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-sm m-0">{row.full_name || "Colecionador"}</p>
          <p className="text-xs text-gray-500 m-0">
            {row.city || "—"}
            {row.distance_km != null ? ` · ~${row.distance_km.toFixed(1)} km` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg leading-none m-0" style={{ color: "hsl(var(--primary))" }}>{row.score_pct}</p>
          <p className="text-[9px] uppercase tracking-wider m-0 text-gray-500">match</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {row.same_city && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center gap-1"><MapPin size={9} /> Mesma cidade</span>}
        {row.compat_album && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-1"><BookOpen size={9} /> Álbum parecido</span>}
        {row.out_of_radius && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Globe2 size={10} /> Fora do raio</span>}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="bg-gray-100 rounded px-1 py-1">
          <p className="m-0 text-gray-500 uppercase">1-1</p>
          <p className="m-0 font-bold text-amber-600 text-sm">{row.mutual_count}</p>
        </div>
        <div className="bg-gray-100 rounded px-1 py-1">
          <p className="m-0 text-gray-500 uppercase">Tem</p>
          <p className="m-0 font-bold text-sm" style={{ color: "hsl(var(--primary))" }}>{row.give_count}</p>
        </div>
        <div className="bg-gray-100 rounded px-1 py-1">
          <p className="m-0 text-gray-500 uppercase">Oferece</p>
          <p className="m-0 font-bold text-sm" style={{ color: "hsl(var(--primary))" }}>{row.receive_count}</p>
        </div>
      </div>
      <button
        onClick={() => !loadingTradeId && onStartTrade(row.id)}
        disabled={!!loadingTradeId}
        className="w-full rounded-full py-2 text-xs font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-60"
        style={{ background: "hsl(var(--primary))" }}
      >
        {loadingTradeId === row.id ? <><Loader2 size={14} className="animate-spin" /> Abrindo...</> : <><MessageCircle size={14} /> Iniciar Troca</>}
      </button>
    </div>
  );
}

function ClusterListPopup({ rows, onStartTrade, loadingTradeId }: { rows: NearbyGeoRow[]; onStartTrade: (id: string) => void; loadingTradeId?: string | null }) {
  const sorted = [...rows].sort((a, b) => b.score_pct - a.score_pct);
  return (
    <div className="min-w-[240px] max-h-[280px] overflow-y-auto space-y-2">
      <p className="font-bold text-sm m-0 sticky top-0 bg-white py-1">{rows.length} colecionadores aqui</p>
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center gap-2 border-t border-gray-100 pt-2 first:border-0 first:pt-0">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0" style={{ background: "hsl(var(--primary))" }}>
            {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.full_name?.[0] || "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate m-0">{r.full_name || "Colecionador"}</p>
            <p className="text-[10px] text-gray-500 m-0">
              {r.city || "—"} · score {r.score_pct}
            </p>
          </div>
          <button
            onClick={() => !loadingTradeId && onStartTrade(r.id)}
            disabled={!!loadingTradeId}
            className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white shrink-0 flex items-center gap-1 disabled:opacity-60"
            style={{ background: "hsl(var(--primary))" }}
          >
            {loadingTradeId === r.id ? <Loader2 size={10} className="animate-spin" /> : null}
            Trocar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function NearMap({ rows, myLat, myLng, radiusKm, onStartTrade }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="w-full h-[60vh] md:h-[70vh] rounded-2xl overflow-hidden glass">
      <MapContainer
        center={[myLat, myLng]}
        zoom={radiusKm <= 25 ? 12 : radiusKm <= 100 ? 10 : 6}
        scrollWheelZoom
        className="w-full h-full"
        style={{ background: "hsl(var(--surface, 220 14% 10%))" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[myLat, myLng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: "hsl(var(--primary))", fillColor: "hsl(var(--primary))", fillOpacity: 0.05, weight: 1 }}
        />
        <Marker position={[myLat, myLng]} icon={userIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>
        <ClusteredMarkers rows={rows} onStartTrade={onStartTrade} />
      </MapContainer>
    </div>
  );
}
