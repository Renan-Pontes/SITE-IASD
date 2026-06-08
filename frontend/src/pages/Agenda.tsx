import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Evento, Grupo, Igreja, Paginated } from "../lib/types";
import { Calendario } from "../components/Calendario";
import { Carregando } from "../ui/components";

export default function Agenda() {
  const [mes, setMes] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [igrejaId, setIgrejaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [proximas, setProximas] = useState(false);

  // Carrega igrejas para o filtro (uma vez).
  useEffect(() => {
    api.get<Paginated<Igreja>>("/api/igrejas/").then((d) => setIgrejas(d.results)).catch(() => {});
  }, []);

  // Grupos da igreja escolhida.
  useEffect(() => {
    setGrupoId("");
    if (!igrejaId) {
      setGrupos([]);
      return;
    }
    api.get<Grupo[]>(`/api/igrejas/${igrejaId}/grupos/`).then(setGrupos).catch(() => setGrupos([]));
  }, [igrejaId]);

  // Busca eventos da janela visível com os filtros.
  useEffect(() => {
    setCarregando(true);
    const de = new Date(mes.getFullYear(), mes.getMonth() - 1, 1).toISOString();
    const ate = new Date(mes.getFullYear(), mes.getMonth() + 2, 0).toISOString();
    const params = new URLSearchParams({ de, ate });
    if (igrejaId) params.set("igreja", igrejaId);
    if (grupoId) params.set("grupo", grupoId);
    if (proximas) params.set("proximas", "1");
    api
      .get<Evento[]>(`/api/calendario/?${params.toString()}`)
      .then(setEventos)
      .finally(() => setCarregando(false));
  }, [mes, igrejaId, grupoId, proximas]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Agenda</h1>

      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={igrejaId}
          onChange={(e) => setIgrejaId(e.target.value)}
          aria-label="Filtrar por igreja"
        >
          <option value="">Todas as igrejas</option>
          {igrejas.map((ig) => (
            <option key={ig.id} value={ig.id}>
              {ig.nome}
            </option>
          ))}
        </select>
        {grupos.length > 0 && (
          <select
            className="input flex-1"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            aria-label="Filtrar por grupo"
          >
            <option value="">Todos os grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-marca-600"
          checked={proximas}
          onChange={(e) => setProximas(e.target.checked)}
        />
        Incluir igrejas próximas (até 50 km)
      </label>

      {carregando && eventos.length === 0 ? (
        <Carregando texto="Carregando agenda..." />
      ) : (
        <Calendario eventos={eventos} mes={mes} onMudarMes={setMes} />
      )}
    </div>
  );
}
