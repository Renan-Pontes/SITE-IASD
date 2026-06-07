import { useNavigate } from "react-router-dom";
import { CheckCheck, Bell } from "lucide-react";
import { api } from "../api/client";
import type { Notificacao } from "../lib/types";
import { Card, SkeletonLista, Vazio, Botao } from "../ui/components";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { formatData, formatHora } from "../lib/format";

export default function Notificacoes() {
  const nav = useNavigate();
  const { items: itens, setItems, hasMore, loading, carregarMais } = useInfinite<Notificacao>(
    (page) => `/api/notificacoes/?page=${page}`,
    [],
  );

  const abrir = async (n: Notificacao) => {
    if (!n.lida) {
      await api.post(`/api/notificacoes/${n.id}/ler/`).catch(() => {});
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    if (n.link) nav(n.link);
  };

  const lerTodas = async () => {
    await api.post("/api/notificacoes/ler_todas/").catch(() => {});
    setItems((xs) => xs.map((x) => ({ ...x, lida: true })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Notificações</h1>
        {itens.some((n) => !n.lida) && (
          <Botao variante="ghost" onClick={lerTodas}>
            <CheckCheck size={18} /> Marcar todas
          </Botao>
        )}
      </div>

      {loading && itens.length === 0 ? (
        <SkeletonLista n={4} />
      ) : itens.length === 0 ? (
        <Vazio titulo="Nenhuma notificação" icone={<Bell size={48} />} />
      ) : (
        <>
          <div className="space-y-2">
            {itens.map((n) => (
              <Card
                key={n.id}
                onClick={() => abrir(n)}
                className={`p-4 ${!n.lida ? "border-l-4 border-l-marca-600 bg-marca-50/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{n.titulo}</h3>
                  {!n.lida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marca-600" />}
                </div>
                {n.mensagem && <p className="text-sm text-slate-600 dark:text-slate-300">{n.mensagem}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {formatData(n.criado_em)} • {formatHora(n.criado_em)}
                </p>
              </Card>
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={loading} />
        </>
      )}
    </div>
  );
}
