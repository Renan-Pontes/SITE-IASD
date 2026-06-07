import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, Bell } from "lucide-react";
import { api } from "../api/client";
import type { Notificacao, Paginated } from "../lib/types";
import { Card, Carregando, Vazio, Botao } from "../ui/components";
import { formatData, formatHora } from "../lib/format";

export default function Notificacoes() {
  const nav = useNavigate();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    api
      .get<Paginated<Notificacao>>("/api/notificacoes/")
      .then((d) => setItens(d.results))
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, []);

  const abrir = async (n: Notificacao) => {
    if (!n.lida) {
      await api.post(`/api/notificacoes/${n.id}/ler/`).catch(() => {});
      setItens((xs) => xs.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    if (n.link) nav(n.link);
  };

  const lerTodas = async () => {
    await api.post("/api/notificacoes/ler_todas/").catch(() => {});
    setItens((xs) => xs.map((x) => ({ ...x, lida: true })));
  };

  if (carregando) return <Carregando />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-800">Notificações</h1>
        {itens.some((n) => !n.lida) && (
          <Botao variante="ghost" onClick={lerTodas}>
            <CheckCheck size={18} /> Marcar todas
          </Botao>
        )}
      </div>

      {itens.length === 0 ? (
        <Vazio titulo="Nenhuma notificação" icone={<Bell size={48} />} />
      ) : (
        <div className="space-y-2">
          {itens.map((n) => (
            <Card
              key={n.id}
              onClick={() => abrir(n)}
              className={`p-4 ${!n.lida ? "border-l-4 border-l-marca-600 bg-marca-50/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800">{n.titulo}</h3>
                {!n.lida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marca-600" />}
              </div>
              {n.mensagem && <p className="text-sm text-slate-600">{n.mensagem}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {formatData(n.criado_em)} • {formatHora(n.criado_em)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
