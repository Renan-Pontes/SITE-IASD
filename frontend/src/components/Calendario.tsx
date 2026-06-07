import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Evento } from "../lib/types";
import { EventoCard } from "./EventoCard";
import { Vazio } from "../ui/components";

type Visao = "mes" | "semana" | "dia";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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

  // Agrupa eventos por dia.
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

  // Navegação: muda por mês/semana/dia conforme a visão e avisa o pai
  // (que rebusca uma janela de eventos ao redor da nova referência).
  const navegar = (delta: number) => {
    if (visao === "mes") {
      const nova = new Date(mes.getFullYear(), mes.getMonth() + delta, 1);
      onMudarMes(nova);
    } else {
      const passo = visao === "semana" ? 7 : 1;
      const nova = new Date(selecionado);
      nova.setDate(selecionado.getDate() + delta * passo);
      setSelecionado(nova);
      onMudarMes(nova);
    }
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
      {/* Alternador de visão */}
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

      {/* Cabeçalho com navegação */}
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
        <VisaoMes
          mes={mes}
          hoje={hoje}
          selecionado={selecionado}
          setSelecionado={setSelecionado}
          porDia={porDia}
        />
      )}
      {visao === "semana" && <VisaoSemana selecionado={selecionado} hoje={hoje} eventosDoDia={eventosDoDia} setSelecionado={(d) => { setSelecionado(d); setVisao("dia"); }} />}
      {visao === "dia" && <ListaDoDia data={selecionado} eventos={eventosDoDia(selecionado)} />}
    </div>
  );
}

function VisaoMes({
  mes, hoje, selecionado, setSelecionado, porDia,
}: {
  mes: Date; hoje: Date; selecionado: Date;
  setSelecionado: (d: Date) => void; porDia: Map<string, Evento[]>;
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
    <>
      <div className="card p-4">
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d, i) => (
            <div key={i} className="py-1 text-center text-xs font-bold text-slate-400">{d}</div>
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
                        ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        : "text-slate-300 dark:text-slate-600"
                }`}
              >
                {d.getDate()}
                {qtd > 0 && (
                  <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${ehSel ? "bg-white" : "bg-ouro-500"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <ListaDoDia data={selecionado} eventos={porDia.get(chaveDia(selecionado)) || []} />
    </>
  );
}

function VisaoSemana({
  selecionado, hoje, eventosDoDia, setSelecionado,
}: {
  selecionado: Date; hoje: Date;
  eventosDoDia: (d: Date) => Evento[]; setSelecionado: (d: Date) => void;
}) {
  const ini = inicioSemana(selecionado);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ini);
    d.setDate(ini.getDate() + i);
    return d;
  });
  return (
    <div className="space-y-3">
      {dias.map((d) => {
        const evs = eventosDoDia(d);
        const ehHoje = chaveDia(d) === chaveDia(hoje);
        return (
          <div key={chaveDia(d)} className="card p-3">
            <button
              onClick={() => setSelecionado(new Date(d))}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <span className={`font-bold ${ehHoje ? "text-marca-700" : "text-slate-700 dark:text-slate-200"}`}>
                {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
                {ehHoje && " • Hoje"}
              </span>
              {evs.length > 0 && (
                <span className="rounded-full bg-marca-100 px-2 py-0.5 text-xs font-bold text-marca-700">
                  {evs.length}
                </span>
              )}
            </button>
            {evs.length === 0 ? (
              <p className="text-sm text-slate-400">Sem eventos</p>
            ) : (
              <div className="space-y-2">
                {evs.map((ev) => (
                  <EventoCard key={`${ev.id}-${ev.inicio}`} evento={ev} mostrarIgreja />
                ))}
              </div>
            )}
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
        <Vazio titulo="Nenhum evento neste dia" />
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
