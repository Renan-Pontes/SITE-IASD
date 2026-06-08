import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, Navigation, Users, Map as MapIcon } from "lucide-react";
import type { Igreja } from "../lib/types";
import { Card, SkeletonLista, Vazio, Badge } from "../ui/components";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { useToast } from "../ui/Toast";

export default function Igrejas() {
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const buildPath = useMemo(
    () => (page: number) => {
      const params = new URLSearchParams();
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      }
      if (buscaAtiva) params.set("search", buscaAtiva);
      params.set("page", String(page));
      return `/api/igrejas/?${params.toString()}`;
    },
    [coords, buscaAtiva],
  );

  const { items: igrejas, hasMore, loading, carregarMais } = useInfinite<Igreja>(
    buildPath,
    [buscaAtiva, coords?.lat, coords?.lng],
  );

  const usarLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.erro("Seu navegador não suporta geolocalização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.sucesso("Ordenado por proximidade.");
      },
      () => toast.erro("Não foi possível obter sua localização."),
    );
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setBuscaAtiva(busca.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Igrejas</h1>
        <Link to="/mapa" className="flex items-center gap-1 text-sm font-semibold text-marca-700">
          <MapIcon size={18} /> Mapa
        </Link>
      </div>

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

      {loading && igrejas.length === 0 ? (
        <SkeletonLista n={4} />
      ) : igrejas.length === 0 ? (
        <Vazio titulo="Nenhuma igreja encontrada" descricao="Tente outro termo de busca." />
      ) : (
        <>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
            {igrejas.map((ig) => (
              <Link key={ig.id} to={`/igreja/${ig.id}`}>
                <Card className="flex items-center gap-4 p-4 transition hover:shadow-md">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-2xl">
                    ⛪
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                      {ig.nome}
                    </h3>
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
                  {ig.distancia_km != null && <Badge cor="marca">{ig.distancia_km} km</Badge>}
                  {ig.meu_status === "ativo" && <Badge cor="ouro">Minha</Badge>}
                </Card>
              </Link>
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={loading} />
        </>
      )}
    </div>
  );
}
