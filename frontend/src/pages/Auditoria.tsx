import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ScrollText, Download, Printer, Filter } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { baixarComAuth } from "../api/client";
import { Card, SkeletonLista, Vazio, Botao } from "../ui/components";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { formatData, formatHora } from "../lib/format";

interface Registro {
  id: number;
  usuario_detalhe: { nome: string } | null;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  detalhes: any;
  criado_em: string;
}

export default function Auditoria() {
  const { ehSuper, souLideranca, me, carregando } = useAuth();
  const nav = useNavigate();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [tipo, setTipo] = useState("");
  // Filtros aplicados (só ao clicar em "Filtrar", para não refazer a query a cada tecla).
  const [aplicados, setAplicados] = useState({ inicio: "", fim: "", tipo: "" });

  const qs = () => {
    const p = new URLSearchParams();
    if (aplicados.inicio) p.set("inicio", aplicados.inicio);
    if (aplicados.fim) p.set("fim", aplicados.fim);
    if (aplicados.tipo) p.set("tipo", aplicados.tipo);
    return p.toString();
  };

  const { items, hasMore, loading, total, carregarMais } = useInfinite<Registro>(
    (page) => {
      const p = qs();
      return `/api/auditoria/?page=${page}${p ? `&${p}` : ""}`;
    },
    [aplicados.inicio, aplicados.fim, aplicados.tipo],
  );

  const ehSecretaria = !!me?.vinculos_igreja.some((v) => v.secretaria && v.status === "ativo");
  const podeVer = ehSuper || souLideranca || ehSecretaria;

  if (carregando) return <SkeletonLista n={4} />;
  if (!podeVer) return <Navigate to="/" replace />;

  const exportar = () => {
    const p = qs();
    baixarComAuth(`/api/auditoria/exportar/${p ? `?${p}` : ""}`, "auditoria.csv").catch(() => {});
  };

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500 print:hidden">
        <ArrowLeft size={20} /> Voltar
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          <ScrollText className="text-marca-600" /> Auditoria
        </h1>
        <div className="flex gap-2 print:hidden">
          <Botao variante="secondary" onClick={exportar}>
            <Download size={16} /> CSV
          </Botao>
          <Botao variante="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </Botao>
        </div>
      </div>

      {/* Filtros */}
      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4 print:hidden">
        <label className="text-sm">
          <span className="label">De</span>
          <input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="label">Até</span>
          <input type="date" className="input" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="label">Tipo (ação/entidade)</span>
          <input
            className="input"
            placeholder="ex.: evento, pauta, voto"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Botao
            full
            onClick={() =>
              setAplicados({
                inicio: inicio ? `${inicio}T00:00:00` : "",
                fim: fim ? `${fim}T23:59:59` : "",
                tipo: tipo.trim(),
              })
            }
          >
            <Filter size={16} /> Filtrar
          </Botao>
        </div>
      </Card>

      {total != null && (
        <p className="text-sm text-slate-400">{total} registro(s).</p>
      )}

      {loading && items.length === 0 ? (
        <SkeletonLista n={5} />
      ) : items.length === 0 ? (
        <Vazio titulo="Sem registros" descricao="Nenhuma atividade no período/filtro." />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((r) => (
              <Card key={r.id} className="flex items-start justify-between gap-2 p-3 text-sm">
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
