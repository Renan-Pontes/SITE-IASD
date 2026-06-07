import { Link } from "react-router-dom";
import { Clock, MapPin, Users, CheckCircle2 } from "lucide-react";
import type { Evento } from "../lib/types";
import { formatDiaSemana, formatData, formatHora, ehHoje } from "../lib/format";
import { Badge } from "../ui/components";

export function EventoCard({ evento, mostrarIgreja }: { evento: Evento; mostrarIgreja?: boolean }) {
  const barra = evento.visibilidade === "privado" ? "bg-slate-400" : "bg-marca-600";
  return (
    <Link
      to={`/evento/${evento.id}`}
      className="card flex overflow-hidden transition hover:shadow-md"
    >
      <div className={`w-2 shrink-0 ${barra}`} />
      <div className="flex-1 p-4">
        <div className="mb-1 flex items-center gap-2">
          {ehHoje(evento.inicio) && <Badge cor="ouro">Hoje</Badge>}
          {evento.visibilidade === "privado" && <Badge cor="cinza">Privado</Badge>}
          {evento.status === "pendente" && <Badge cor="vermelho">Aguardando</Badge>}
          {evento.grupo_nome && <Badge cor="azul">{evento.grupo_nome}</Badge>}
        </div>
        <h3 className="text-lg font-bold leading-tight text-slate-800">{evento.titulo}</h3>
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={16} className="text-marca-600" />
            <span className="font-medium text-slate-600">
              {formatDiaSemana(evento.inicio)}, {formatData(evento.inicio)} • {formatHora(evento.inicio)}
            </span>
          </div>
          {mostrarIgreja && (
            <div className="flex items-center gap-1.5">
              <MapPin size={16} className="text-marca-600" />
              {evento.igreja_nome}
              {evento.igreja && evento.igreja_nome && evento.sala_nome && ` • ${evento.sala_nome}`}
            </div>
          )}
          <div className="flex items-center gap-3">
            {evento.total_confirmados > 0 && (
              <span className="flex items-center gap-1">
                <Users size={16} className="text-marca-600" />
                {evento.total_confirmados} confirmado{evento.total_confirmados > 1 ? "s" : ""}
              </span>
            )}
            {evento.meu_rsvp === "confirmado" && (
              <span className="flex items-center gap-1 font-semibold text-marca-700">
                <CheckCircle2 size={16} /> Eu vou
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
