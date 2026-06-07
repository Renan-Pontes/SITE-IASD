import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Evento } from "../lib/types";
import { EventoCard } from "./EventoCard";
import { Vazio } from "../ui/components";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function Calendario({
  eventos,
  mes,
  onMudarMes,
}: {
  eventos: Evento[];
  mes: Date;
  onMudarMes: (d: Date) => void;
}) {
  const hoje = new Date();
  const [selecionado, setSelecionado] = useState<Date>(hoje);

  // Agrupa eventos por dia.
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const d = new Date(ev.inicio);
      const k = chaveDia(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ev);
    }
    return m;
  }, [eventos]);

  // Monta a grade do mês.
  const celulas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicioGrade);
      d.setDate(inicioGrade.getDate() + i);
      return d;
    });
  }, [mes]);

  const eventosDoDia = porDia.get(chaveDia(selecionado)) || [];

  const navegar = (delta: number) =>
    onMudarMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1));

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => navegar(-1)}
            className="rounded-full p-2 hover:bg-slate-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={24} className="text-marca-700" />
          </button>
          <h2 className="text-lg font-bold text-slate-800">
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </h2>
          <button
            onClick={() => navegar(1)}
            className="rounded-full p-2 hover:bg-slate-100"
            aria-label="Próximo mês"
          >
            <ChevronRight size={24} className="text-marca-700" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d, i) => (
            <div key={i} className="py-1 text-center text-xs font-bold text-slate-400">
              {d}
            </div>
          ))}
          {celulas.map((d, i) => {
            const noMes = d.getMonth() === mes.getMonth();
            const ehHoje = chaveDia(d) === chaveDia(hoje);
            const ehSel = chaveDia(d) === chaveDia(selecionado);
            const qtd = (porDia.get(chaveDia(d)) || []).length;
            return (
              <button
                key={i}
                onClick={() => setSelecionado(new Date(d))}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                  ehSel
                    ? "bg-marca-700 font-bold text-white"
                    : ehHoje
                      ? "bg-marca-100 font-bold text-marca-800"
                      : noMes
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-300"
                }`}
              >
                {d.getDate()}
                {qtd > 0 && (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                      ehSel ? "bg-white" : "bg-ouro-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 px-1 font-semibold text-slate-600">
          {selecionado.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </h3>
        {eventosDoDia.length === 0 ? (
          <Vazio titulo="Nenhum evento neste dia" />
        ) : (
          <div className="space-y-3">
            {eventosDoDia
              .sort((a, b) => a.inicio.localeCompare(b.inicio))
              .map((ev) => (
                <EventoCard key={`${ev.id}-${ev.inicio}`} evento={ev} mostrarIgreja />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
