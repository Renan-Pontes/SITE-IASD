import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client";
import type { Igreja, Paginated } from "../lib/types";
import { Carregando, Vazio } from "../ui/components";

// Pin verde custom (evita o problema dos ícones-imagem do Leaflet em bundlers).
const pinoVerde = L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:#047857;transform:rotate(-45deg);
    border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
    display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:13px;">✛</span>
    </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

export default function Mapa() {
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const acc: Igreja[] = [];
      let page = 1;
      let more = true;
      while (more && page <= 20) {
        try {
          const d = await api.get<Paginated<Igreja>>(`/api/igrejas/?page=${page}`);
          acc.push(...d.results);
          more = !!d.next;
          page++;
        } catch {
          more = false;
        }
      }
      if (!cancel) {
        setIgrejas(acc.filter((i) => i.latitude != null && i.longitude != null));
        setCarregando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (carregando) return <Carregando texto="Carregando mapa..." />;

  const centro: [number, number] =
    igrejas.length > 0
      ? [Number(igrejas[0].latitude), Number(igrejas[0].longitude)]
      : [-23.5505, -46.6333];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Mapa das igrejas</h1>

      {igrejas.length === 0 ? (
        <Vazio
          titulo="Nenhuma igreja com localização"
          descricao="As igrejas aparecem aqui quando têm coordenadas cadastradas."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <MapContainer center={centro} zoom={igrejas.length > 1 ? 6 : 13} style={{ height: "70vh", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {igrejas.map((ig) => (
              <Marker
                key={ig.id}
                position={[Number(ig.latitude), Number(ig.longitude)]}
                icon={pinoVerde}
              >
                <Popup>
                  <div className="space-y-1">
                    <strong className="text-marca-800">{ig.nome}</strong>
                    <div className="text-slate-500">
                      {ig.cidade}
                      {ig.estado && `/${ig.estado}`}
                    </div>
                    <Link
                      to={`/igreja/${ig.id}`}
                      className="mt-1 inline-block font-semibold text-marca-700"
                    >
                      Visitar agenda →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
