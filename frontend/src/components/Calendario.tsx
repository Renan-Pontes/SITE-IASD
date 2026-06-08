import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { Link } from "react-router-dom";
import type { Evento } from "../lib/types";
import { EventoCard } from "./EventoCard";
import { AgendaDiaModal } from "./AgendaDiaModal";
import { Vazio } from "../ui/components";
import { formatHora } from "../lib/format";

type Visao = "mes" | "semana" | "dia";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_LONGO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Paleta para colorir o evento por grupo (dá noção de "tipo").
const PALETA = [
  "bg-marca-600", "bg-blue-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-600", "bg-orange-500",
];
function corEvento(ev: Evento) {
  return ev.grupo ? PALETA[ev.grupo % PALETA.length] : "bg-marca-600";
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function inicioSemana(d: Date) {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
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
  const [visao, setVisao] = useState<Visao>("mes");
  const [selecionado, setSelecionado] = useState<Date>(hoje);
  const [modalDia, setModalDia] = useState<Date | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const k = chaveDia(new Date(ev.inicio));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ev);
    }
    for (const lista of m.values()) lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return m;
  }, [eventos]);

  const eventosDoDia = (d: Date) => porDia.get(chaveDia(d)) || [];

  const navegar = (delta: number) => {
    if (visao === "mes") {
      onMudarMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1));
    } else {
      const passo = visao === "semana" ? 7 : 1;
      const nova = new Date(selecionado);
      nova.setDate(selecionado.getDate() + delta * passo);
      setSelecionado(nova);
      onMudarMes(nova);
    }
  };

  const abrirDia = (d: Date) => setModalDia(new Date(d));
  const navegarModal = (delta: number) => {
    setModalDia((d) => {
      if (!d) return d;
      const nova = new Date(d);
      nova.setDate(d.getDate() + delta);
      return nova;
    });
  };

  const titulo =
    visao === "dia"
      ? selecionado.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : visao === "semana"
        ? (() => {
            const ini = inicioSemana(selecionado);
            const fim = new Date(ini);
            fim.setDate(ini.getDate() + 6);
            return `${ini.getDate()}/${ini.getMonth() + 1} – ${fim.getDate()}/${fim.getMonth() + 1}`;
          })()
        : `${MESES[mes.getMonth()]} ${mes.getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(["mes", "semana", "dia"] as Visao[]).map((v) => (
          <button
            key={v}
            onClick={() => setVisao(v)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
              visao === v
                ? "bg-white text-marca-700 shadow-sm dark:bg-slate-700 dark:text-marca-300"
                : "text-slate-500"
            }`}
          >
            {v === "mes" ? "Mês" : v}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => navegar(-1)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Anterior">
          <ChevronLeft size={24} className="text-marca-700 dark:text-marca-300" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
        <button onClick={() => navegar(1)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Próximo">
          <ChevronRight size={24} className="text-marca-700 dark:text-marca-300" />
        </button>
      </div>

      {visao === "mes" && (
        <VisaoMes mes={mes} hoje={hoje} porDia={porDia} aoAbrirDia={abrirDia} />
      )}
      {visao === "semana" && (
        <VisaoSemana selecionado={selecionado} hoje={hoje} eventosDoDia={eventosDoDia} aoAbrirDia={abrirDia} />
      )}
      {visao === "dia" && <ListaDoDia data={selecionado} eventos={eventosDoDia(selecionado)} />}

      <AgendaDiaModal
        data={modalDia}
        eventos={modalDia ? eventosDoDia(modalDia) : []}
        aoFechar={() => setModalDia(null)}
        aoNavegar={navegarModal}
      />
    </div>
  );
}

function VisaoMes({
  mes, hoje, porDia, aoAbrirDia,
}: {
  mes: Date; hoje: Date; porDia: Map<string, Evento[]>; aoAbrirDia: (d: Date) => void;
}) {
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

  return (
    <div className="card p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d, i) => (
          <div key={i} className="py-1 text-center text-xs font-bold text-slate-400">{d}</div>
        ))}
        {celulas.map((d, i) => {
          const noMes = d.getMonth() === mes.getMonth();
          const ehHoje = chaveDia(d) === chaveDia(hoje);
          const evs = porDia.get(chaveDia(d)) || [];
          return (
            <button
              key={i}
              onClick={() => aoAbrirDia(d)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                ehHoje
                  ? "bg-marca-600 font-bold text-white"
                  : noMes
                    ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    : "text-slate-300 dark:text-slate-600"
              }`}
            >
              {d.getDate()}
              {evs.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {evs.slice(0, 3).map((ev, j) => (
                    <span key={j} className={`h-1.5 w-1.5 rounded-full ${ehHoje ? "bg-white" : corEvento(ev)}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">Toque num dia para ver os eventos.</p>
    </div>
  );
}

function VisaoSemana({
  selecionado, hoje, eventosDoDia, aoAbrirDia,
}: {
  selecionado: Date; hoje: Date;
  eventosDoDia: (d: Date) => Evento[]; aoAbrirDia: (d: Date) => void;
}) {
  const ini = inicioSemana(selecionado);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ini);
    d.setDate(ini.getDate() + i);
    return d;
  });
  const totalSemana = dias.reduce((s, d) => s + eventosDoDia(d).length, 0);

  if (totalSemana === 0) {
    return <Vazio titulo="Nenhum evento nesta semana" icone={<CalendarOff size={48} />} />;
  }

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x lg:mx-0 lg:grid lg:grid-cols-7 lg:gap-1.5 lg:overflow-visible lg:px-0">
      {dias.map((d) => {
        const evs = eventosDoDia(d);
        const ehHoje = chaveDia(d) === chaveDia(hoje);
        return (
          <div
            key={chaveDia(d)}
            className="w-[44vw] shrink-0 snap-start sm:w-[180px] lg:w-auto"
          >
            <button
              onClick={() => aoAbrirDia(d)}
              className={`sticky top-0 mb-2 w-full rounded-xl py-2 text-center text-sm font-bold transition ${
                ehHoje
                  ? "bg-marca-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {DIAS_LONGO[d.getDay()]} {d.getDate()}
            </button>
            <div className="space-y-1.5">
              {evs.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-300 dark:text-slate-600">—</p>
              ) : (
                evs.map((ev) => (
                  <Link
                    key={`${ev.id}-${ev.inicio}`}
                    to={`/evento/${ev.id}`}
                    className="block overflow-hidden rounded-lg border border-slate-100 bg-white text-xs shadow-sm hover:shadow dark:border-slate-800"
                  >
                    <div className="flex">
                      <span className={`w-1 shrink-0 ${corEvento(ev)}`} />
                      <span className="min-w-0 p-2">
                        <span className="block font-bold text-marca-700 dark:text-marca-300">
                          {formatHora(ev.inicio)}
                        </span>
                        <span className="block truncate font-medium text-slate-700 dark:text-slate-200">
                          {ev.titulo}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaDoDia({ data, eventos }: { data: Date; eventos: Evento[] }) {
  return (
    <div>
      <h3 className="mb-2 px-1 font-semibold capitalize text-slate-600 dark:text-slate-300">
        {data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
      </h3>
      {eventos.length === 0 ? (
        <Vazio titulo="Nenhum evento neste dia" icone={<CalendarOff size={48} />} />
      ) : (
        <div className="space-y-3">
          {eventos.map((ev) => (
            <EventoCard key={`${ev.id}-${ev.inicio}`} evento={ev} mostrarIgreja />
          ))}
        </div>
      )}
    </div>
  );
}
