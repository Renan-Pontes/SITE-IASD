import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Clock, MapPin, User as UserIcon,
  CheckCircle2, ArrowRight,
} from "lucide-react";
import type { Evento, StatusInscricao } from "../lib/types";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";
import { formatHora } from "../lib/format";

/**
 * Modal com tudo de um dia: eventos (foto, título, hora, local, criador),
 * confirmar presença direto, ir ao detalhe, e navegar dia anterior/próximo.
 * Tela cheia no mobile (herda do Modal), centralizado no desktop.
 */
export function AgendaDiaModal({
  data,
  eventos,
  aoFechar,
  aoNavegar,
}: {
  data: Date | null;
  eventos: Evento[];
  aoFechar: () => void;
  aoNavegar: (delta: number) => void;
}) {
  const { logado } = useAuth();
  const toast = useToast();
  const [rsvpLocal, setRsvpLocal] = useState<Record<number, StatusInscricao>>({});

  useEffect(() => {
    setRsvpLocal({});
  }, [data?.toDateString()]);

  if (!data) return null;

  const titulo = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const confirmar = async (ev: Evento) => {
    if (!logado) {
      toast.info("Entre para confirmar presença.");
      return;
    }
    const jaVou = (rsvpLocal[ev.id] || ev.meu_rsvp) === "confirmado";
    const novo: StatusInscricao = jaVou ? "cancelado" : "confirmado";
    setRsvpLocal((r) => ({ ...r, [ev.id]: novo }));
    try {
      await api.post(`/api/eventos/${ev.id}/rsvp/`, { status: novo });
      toast.sucesso(novo === "confirmado" ? "Presença confirmada! 🎉" : "Presença cancelada.");
    } catch {
      setRsvpLocal((r) => ({ ...r, [ev.id]: jaVou ? "confirmado" : "cancelado" }));
      toast.erro("Não foi possível registrar.");
    }
  };

  return (
    <Modal
      aberto={!!data}
      aoFechar={aoFechar}
      titulo={titulo.charAt(0).toUpperCase() + titulo.slice(1)}
    >
      <div className="-mt-1 mb-3 flex items-center justify-between">
        <button
          onClick={() => aoNavegar(-1)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-marca-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={18} /> Dia anterior
        </button>
        <button
          onClick={() => aoNavegar(1)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-marca-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Próximo dia <ChevronRight size={18} />
        </button>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        {eventos.length === 0 ? (
          <p className="py-10 text-center text-slate-400">Nenhum evento neste dia.</p>
        ) : (
          eventos
            .slice()
            .sort((a, b) => a.inicio.localeCompare(b.inicio))
            .map((ev) => {
              const meu = rsvpLocal[ev.id] || ev.meu_rsvp;
              const vou = meu === "confirmado";
              return (
                <div key={`${ev.id}-${ev.inicio}`} className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  {ev.foto && <img src={ev.foto} alt={ev.titulo} className="h-28 w-full object-cover" />}
                  <div className="p-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{ev.titulo}</h3>
                    <div className="mt-1 space-y-0.5 text-sm text-slate-500">
                      <p className="flex items-center gap-1.5">
                        <Clock size={14} className="text-marca-600" /> {formatHora(ev.inicio)} – {formatHora(ev.fim)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-marca-600" /> {ev.igreja_nome}
                        {ev.sala_nome ? ` • ${ev.sala_nome}` : ""}
                      </p>
                      {ev.criado_por_detalhe && (
                        <p className="flex items-center gap-1.5">
                          <UserIcon size={14} className="text-marca-600" /> {ev.criado_por_detalhe.nome}
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirmar(ev)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
                          vou
                            ? "bg-marca-600 text-white"
                            : "border-2 border-marca-200 text-marca-700 hover:bg-marca-50"
                        }`}
                      >
                        <CheckCircle2 size={18} /> {vou ? "Eu vou ✓" : "Confirmar presença"}
                      </button>
                      <Link
                        to={`/evento/${ev.id}`}
                        onClick={aoFechar}
                        className="flex items-center justify-center gap-1 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                      >
                        Ver <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </Modal>
  );
}
