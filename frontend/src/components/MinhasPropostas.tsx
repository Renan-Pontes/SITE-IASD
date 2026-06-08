import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import type { Pauta, Paginated } from "../lib/types";
import { Card } from "../ui/components";
import { rotulo } from "../lib/format";

/**
 * "Minhas propostas em andamento" — pautas que o usuário propôs e ainda estão
 * abertas. Funciona para qualquer proponente (mesmo não-ancião).
 */
export function MinhasPropostas() {
  const [pautas, setPautas] = useState<Pauta[]>([]);

  useEffect(() => {
    api
      .get<Paginated<Pauta> | Pauta[]>("/api/pautas/minhas/")
      .then((d) => {
        const lista = Array.isArray(d) ? d : d.results;
        setPautas(lista.filter((p) => p.status === "aberta"));
      })
      .catch(() => {});
  }, []);

  if (pautas.length === 0) return null;

  return (
    <Card className="border-2 border-blue-200 bg-blue-50 p-4 dark:bg-blue-900/20">
      <h2 className="mb-2 flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
        <FileText size={20} /> Minhas propostas em votação
      </h2>
      <div className="space-y-2">
        {pautas.map((p) => {
          const pct = p.total_eleitores
            ? Math.round((p.total_votos / p.total_eleitores) * 100)
            : 0;
          return (
            <Link
              key={p.id}
              to={`/pauta/${p.id}`}
              className="block rounded-lg bg-white p-3 dark:bg-slate-800"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</p>
                  <p className="text-xs text-slate-400">{rotulo.tipoPauta(p.tipo)} • {p.igreja_nome}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-400">
                  {p.total_votos}/{p.total_eleitores} votaram
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
