import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, CalendarDays, UserPlus, Clock } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../ui/Toast";
import type { Evento, Membro, Paginated } from "../lib/types";
import { Card, Carregando, Avatar, Vazio, Badge } from "../ui/components";
import { formatData, formatHora, formatDiaSemana } from "../lib/format";

export default function Aprovacoes() {
  const toast = useToast();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    setCarregando(true);
    Promise.all([
      api.get<Evento[]>("/api/eventos/pendentes/"),
      api.get<Paginated<Membro>>("/api/membros/?status=pendente"),
    ])
      .then(([evs, ms]) => {
        setEventos(evs);
        setMembros(ms.results);
      })
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, []);

  const evento = async (id: number, tipo: "aprovar" | "rejeitar") => {
    try {
      await api.post(`/api/eventos/${id}/${tipo}/`);
      toast.sucesso(tipo === "aprovar" ? "Evento aprovado!" : "Evento rejeitado.");
      setEventos((e) => e.filter((x) => x.id !== id));
    } catch {
      toast.erro("Erro ao processar.");
    }
  };

  const membro = async (id: number, tipo: "aprovar" | "rejeitar") => {
    try {
      await api.post(`/api/membros/${id}/${tipo}/`);
      toast.sucesso(tipo === "aprovar" ? "Membro aprovado!" : "Pedido recusado.");
      setMembros((m) => m.filter((x) => x.id !== id));
    } catch {
      toast.erro("Erro ao processar.");
    }
  };

  if (carregando) return <Carregando />;
  const vazio = eventos.length === 0 && membros.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-800">Aprovações</h1>

      {vazio && (
        <Vazio
          titulo="Tudo em dia! ✅"
          descricao="Não há eventos ou pedidos de entrada aguardando aprovação."
          icone={<Check size={48} />}
        />
      )}

      {membros.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-700">
            <UserPlus size={20} className="text-marca-600" /> Pedidos de entrada ({membros.length})
          </h2>
          <div className="space-y-2">
            {membros.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3">
                <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{m.usuario_detalhe.nome}</p>
                  <p className="text-sm text-slate-500">{m.igreja_nome}</p>
                </div>
                <button
                  onClick={() => membro(m.id, "aprovar")}
                  className="rounded-full bg-marca-600 p-2.5 text-white"
                  aria-label="Aprovar"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => membro(m.id, "rejeitar")}
                  className="rounded-full bg-red-100 p-2.5 text-red-600"
                  aria-label="Recusar"
                >
                  <X size={20} />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {eventos.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-700">
            <CalendarDays size={20} className="text-marca-600" /> Eventos pendentes ({eventos.length})
          </h2>
          <div className="space-y-3">
            {eventos.map((ev) => (
              <Card key={ev.id} className="p-4">
                <div className="mb-1 flex gap-2">
                  {ev.grupo_nome && <Badge cor="azul">{ev.grupo_nome}</Badge>}
                  <Badge cor="cinza">por {ev.criado_por_detalhe?.nome}</Badge>
                </div>
                <Link to={`/evento/${ev.id}`}>
                  <h3 className="text-lg font-bold text-slate-800">{ev.titulo}</h3>
                </Link>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock size={15} className="text-marca-600" />
                  {formatDiaSemana(ev.inicio)}, {formatData(ev.inicio)} • {formatHora(ev.inicio)}
                </p>
                <p className="text-sm text-slate-500">{ev.igreja_nome}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => evento(ev.id, "aprovar")}
                    className="btn-primary flex-1 !py-2.5"
                  >
                    <Check size={18} /> Aprovar
                  </button>
                  <button
                    onClick={() => evento(ev.id, "rejeitar")}
                    className="btn-perigo flex-1 !py-2.5"
                  >
                    <X size={18} /> Rejeitar
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
