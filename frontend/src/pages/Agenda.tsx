import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Evento } from "../lib/types";
import { Calendario } from "../components/Calendario";
import { Carregando } from "../ui/components";

export default function Agenda() {
  const [mes, setMes] = useState(() => new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    // Busca uma janela folgada ao redor do mês visível.
    const de = new Date(mes.getFullYear(), mes.getMonth() - 1, 1).toISOString();
    const ate = new Date(mes.getFullYear(), mes.getMonth() + 2, 0).toISOString();
    api
      .get<Evento[]>(`/api/calendario/?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`)
      .then(setEventos)
      .finally(() => setCarregando(false));
  }, [mes]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800">Agenda</h1>
      {carregando && eventos.length === 0 ? (
        <Carregando texto="Carregando agenda..." />
      ) : (
        <Calendario eventos={eventos} mes={mes} onMudarMes={setMes} />
      )}
    </div>
  );
}
