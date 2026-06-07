import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Card, SkeletonLista, Vazio } from "../ui/components";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { formatData, formatHora } from "../lib/format";

interface Registro {
  id: number;
  usuario_detalhe: { nome: string } | null;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  criado_em: string;
}

export default function Auditoria() {
  const { ehSuper, carregando } = useAuth();
  const nav = useNavigate();
  const { items, hasMore, loading, carregarMais } = useInfinite<Registro>(
    (page) => `/api/auditoria/?page=${page}`,
    [],
  );

  if (carregando) return <SkeletonLista n={4} />;
  if (!ehSuper) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
        <ScrollText className="text-marca-600" /> Auditoria
      </h1>

      {loading && items.length === 0 ? (
        <SkeletonLista n={5} />
      ) : items.length === 0 ? (
        <Vazio titulo="Sem registros" />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {r.usuario_detalhe?.nome || "Sistema"}
                  </span>
                  <span className="text-slate-500">
                    {" "}— {r.acao}
                    {r.entidade && ` (${r.entidade}#${r.entidade_id ?? "?"})`}
                  </span>
                </div>
                <span className="shrink-0 pl-2 text-xs text-slate-400">
                  {formatData(r.criado_em)} {formatHora(r.criado_em)}
                </span>
              </Card>
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={loading} />
        </>
      )}
    </div>
  );
}
