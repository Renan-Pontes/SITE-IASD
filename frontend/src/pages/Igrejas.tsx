import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, Navigation, Users } from "lucide-react";
import { api } from "../api/client";
import type { Igreja, Paginated } from "../lib/types";
import { Card, SkeletonLista, Vazio, Badge } from "../ui/components";
import { useToast } from "../ui/Toast";

export default function Igrejas() {
  const toast = useToast();
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const carregar = (lat?: number, lng?: number, q?: string) => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (lat != null && lng != null) {
      params.set("lat", String(lat));
      params.set("lng", String(lng));
    }
    if (q) params.set("search", q);
    api
      .get<Paginated<Igreja>>(`/api/igrejas/?${params.toString()}`)
      .then((d) => setIgrejas(d.results))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const usarLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.erro("Seu navegador não suporta geolocalização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        carregar(c.lat, c.lng, busca);
        toast.sucesso("Ordenado por proximidade.");
      },
      () => toast.erro("Não foi possível obter sua localização."),
    );
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    carregar(coords?.lat, coords?.lng, busca);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800">Igrejas</h1>

      <form onSubmit={buscar} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            className="input pl-10"
            placeholder="Buscar por nome ou cidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={usarLocalizacao}
          className="btn-secondary !px-4"
          aria-label="Usar minha localização"
          title="Ordenar por proximidade"
        >
          <Navigation size={20} />
        </button>
      </form>

      {carregando ? (
        <SkeletonLista n={3} />
      ) : igrejas.length === 0 ? (
        <Vazio titulo="Nenhuma igreja encontrada" descricao="Tente outro termo de busca." />
      ) : (
        <div className="space-y-3">
          {igrejas.map((ig) => (
            <Link key={ig.id} to={`/igreja/${ig.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:shadow-md">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-2xl">
                  ⛪
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-slate-800">{ig.nome}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={15} />
                      {ig.cidade}
                      {ig.estado && `, ${ig.estado}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={15} />
                      {ig.total_membros}
                    </span>
                  </div>
                </div>
                {ig.distancia_km != null && (
                  <Badge cor="marca">{ig.distancia_km} km</Badge>
                )}
                {ig.meu_status === "ativo" && <Badge cor="ouro">Minha</Badge>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
