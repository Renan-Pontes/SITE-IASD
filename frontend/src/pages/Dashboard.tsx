import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  UserPlus,
  Vote,
  MapPin,
  Plus,
  ChevronRight,
  Gavel,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Dashboard as DashboardData } from "../lib/types";
import { EventoCard } from "../components/EventoCard";
import { MinhasPendencias } from "../components/MinhasPendencias";
import { MinhasPropostas } from "../components/MinhasPropostas";
import { Botao, Card, SkeletonLista, Vazio } from "../ui/components";

export default function Dashboard() {
  const { me } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<DashboardData>("/api/dashboard/")
      .then(setData)
      .finally(() => setCarregando(false));
  }, []);

  const primeiroNome = me?.profile.nome.split(" ")[0] || "";
  const pend = data?.pendencias;
  const temPendencias =
    !!pend && (pend.eventos > 0 || pend.membros > 0 || pend.pautas_abertas > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          Olá, {primeiroNome}! 👋
        </h1>
        <p className="text-slate-500">Veja o que está acontecendo na sua igreja.</p>
      </div>

      <MinhasPendencias />
      <MinhasPropostas />

      {/* Atalhos da liderança */}
      {data?.sou_lideranca && temPendencias && (
        <Card className="border-ouro-400 bg-amber-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-amber-900">
            <CheckSquare size={20} /> Pendências da liderança
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/aprovacoes"
              className="flex flex-col items-center rounded-xl bg-white p-3 text-center"
            >
              <CalendarDays className="text-marca-600" size={24} />
              <span className="mt-1 text-2xl font-extrabold text-slate-800">
                {pend!.eventos}
              </span>
              <span className="text-xs text-slate-500">Eventos</span>
            </Link>
            <Link
              to="/aprovacoes"
              className="flex flex-col items-center rounded-xl bg-white p-3 text-center"
            >
              <UserPlus className="text-marca-600" size={24} />
              <span className="mt-1 text-2xl font-extrabold text-slate-800">
                {pend!.membros}
              </span>
              <span className="text-xs text-slate-500">Membros</span>
            </Link>
            <Link
              to="/pautas"
              className="flex flex-col items-center rounded-xl bg-white p-3 text-center"
            >
              <Vote className="text-marca-600" size={24} />
              <span className="mt-1 text-2xl font-extrabold text-slate-800">
                {pend!.pautas_abertas}
              </span>
              <span className="text-xs text-slate-500">Pautas</span>
            </Link>
          </div>
        </Card>
      )}

      {data?.sou_lideranca && (
        <div className="flex gap-3">
          <Link to="/pautas" className="btn-secondary flex-1">
            <Vote size={20} /> Pautas
          </Link>
          <Link to="/aprovacoes" className="btn-secondary flex-1">
            <CheckSquare size={20} /> Aprovações
          </Link>
        </div>
      )}

      {/* Pautas aguardando o voto do ancião */}
      {data && data.pautas_aguardando.length > 0 && (
        <Card className="border-2 border-marca-300 bg-marca-50 p-4 dark:bg-marca-900/20">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-marca-800 dark:text-marca-200">
            <Gavel size={20} /> Pautas aguardando seu voto
          </h2>
          <div className="space-y-2">
            {data.pautas_aguardando.map((p) => (
              <Link
                key={p.id}
                to={`/pauta/${p.id}`}
                className="flex items-center gap-2 rounded-lg bg-white p-2.5 dark:bg-slate-800"
              >
                <Vote size={16} className="shrink-0 text-marca-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</p>
                  <p className="truncate text-xs text-slate-400">{p.igreja_nome}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Próximos eventos da minha igreja */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Próximos na minha igreja</h2>
          <Link to="/agenda" className="flex items-center text-sm font-semibold text-marca-700">
            Agenda <ChevronRight size={16} />
          </Link>
        </div>
        {carregando ? (
          <SkeletonLista n={2} />
        ) : data && data.eventos_minha_igreja.length > 0 ? (
          <div className="space-y-3">
            {data.eventos_minha_igreja.map((ev) => (
              <EventoCard key={ev.id} evento={ev} />
            ))}
          </div>
        ) : (
          <Vazio
            titulo="Nenhum evento por aqui ainda"
            descricao="Entre em uma igreja para ver a programação dela."
            acao={
              <Link to="/igrejas">
                <Botao variante="secondary">Encontrar minha igreja</Botao>
              </Link>
            }
          />
        )}
      </section>

      {/* Eventos próximos em outras igrejas */}
      {data && data.eventos_proximos.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <MapPin size={18} className="text-marca-600" />
            <h2 className="text-lg font-bold text-slate-800">Perto de você</h2>
          </div>
          <div className="space-y-3">
            {data.eventos_proximos.map((ev) => (
              <EventoCard key={ev.id} evento={ev} mostrarIgreja />
            ))}
          </div>
        </section>
      )}

      <Link to="/evento/novo" className="btn-primary fixed bottom-20 right-4 z-20 shadow-lg !rounded-full !px-5">
        <Plus size={22} /> Evento
      </Link>
    </div>
  );
}
