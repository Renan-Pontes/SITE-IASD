import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Clock, MapPin, Users, CheckCircle2, HelpCircle, XCircle, Church,
  Check, X, Pencil, Trash2, ArrowLeft, Image as ImageIcon,
} from "lucide-react";
import { UploadFoto } from "../components/UploadFoto";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Evento, Inscricao } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar, Vazio } from "../ui/components";
import { Confirmacao, Modal } from "../ui/Modal";
import { formatIntervalo, formatDiaSemana, rotulo } from "../lib/format";

export default function EventoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { logado, me } = useAuth();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Inscricao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [modalRejeitar, setModalRejeitar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const recarregar = () => api.get<Evento>(`/api/eventos/${id}/`).then(setEvento);

  useEffect(() => {
    recarregar().catch(() => toast.erro("Evento não encontrado."));
    api
      .get<Inscricao[]>(`/api/eventos/${id}/participantes/`)
      .then(setParticipantes)
      .catch(() => {});
  }, [id]);

  const rsvp = async (status: "confirmado" | "talvez" | "cancelado") => {
    if (!logado) {
      nav("/entrar", { state: { de: `/evento/${id}` } });
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/api/eventos/${id}/rsvp/`, { status });
      await recarregar();
      const p = await api.get<Inscricao[]>(`/api/eventos/${id}/participantes/`);
      setParticipantes(p);
      toast.sucesso(
        status === "confirmado"
          ? "Presença confirmada! 🎉"
          : status === "talvez"
            ? "Marcado como talvez."
            : "Presença cancelada.",
      );
    } catch {
      toast.erro("Não foi possível registrar.");
    } finally {
      setSalvando(false);
    }
  };

  const aprovar = async () => {
    try {
      await api.post(`/api/eventos/${id}/aprovar/`);
      toast.sucesso("Evento aprovado!");
      recarregar();
    } catch {
      toast.erro("Erro ao aprovar.");
    }
  };

  const rejeitar = async () => {
    try {
      await api.post(`/api/eventos/${id}/rejeitar/`, { motivo });
      toast.info("Evento rejeitado.");
      setModalRejeitar(false);
      recarregar();
    } catch {
      toast.erro("Erro ao rejeitar.");
    }
  };

  const excluir = async () => {
    try {
      await api.del(`/api/eventos/${id}/`);
      toast.sucesso("Evento excluído.");
      nav(-1);
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao excluir.");
    }
  };

  if (!evento) return <Carregando />;

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(
    evento.igreja_nome + (evento.sala_nome ? " " + evento.sala_nome : ""),
  )}`;
  const podeGerir =
    evento.posso_aprovar || (!!me && evento.criado_por === me.profile.id);

  return (
    <div className="space-y-5 pb-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>

      <Card className="overflow-hidden">
        {evento.foto && (
          <img src={evento.foto} alt={evento.titulo} className="h-44 w-full object-cover" />
        )}
        <div className="bg-gradient-to-br from-marca-600 to-marca-800 p-6 text-white">
          <div className="mb-2 flex flex-wrap gap-2">
            {evento.grupo_nome && <Badge cor="azul">{evento.grupo_nome}</Badge>}
            {evento.visibilidade === "privado" && <Badge cor="cinza">Privado</Badge>}
            {evento.status !== "aprovado" && (
              <Badge cor={evento.status === "pendente" ? "ouro" : "vermelho"}>
                {rotulo.statusEvento(evento.status)}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-extrabold">{evento.titulo}</h1>
          <p className="mt-1 text-marca-50">{formatDiaSemana(evento.inicio)}</p>
        </div>

        <div className="space-y-3 p-5 text-slate-700">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 text-marca-600" size={20} />
            <span className="font-medium">{formatIntervalo(evento.inicio, evento.fim)}</span>
          </div>
          <Link to={`/igreja/${evento.igreja}`} className="flex items-start gap-3 hover:underline">
            <Church className="mt-0.5 text-marca-600" size={20} />
            <span>{evento.igreja_nome}</span>
          </Link>
          {evento.sala_nome && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 hover:underline">
              <MapPin className="mt-0.5 text-marca-600" size={20} />
              <span>{evento.sala_nome}</span>
            </a>
          )}
          {evento.descricao && (
            <p className="whitespace-pre-wrap pt-2 text-slate-600">{evento.descricao}</p>
          )}
          {evento.status === "rejeitado" && evento.motivo_rejeicao && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Motivo da não aprovação: {evento.motivo_rejeicao}
            </p>
          )}
        </div>
      </Card>

      {/* RSVP — botão grande "EU VOU" */}
      {evento.status === "aprovado" && (
        <Card className="p-4">
          <h2 className="mb-3 text-center font-bold text-slate-700">Você vai a este evento?</h2>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => rsvp("confirmado")}
              disabled={salvando}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 font-semibold transition ${
                evento.meu_rsvp === "confirmado"
                  ? "border-marca-600 bg-marca-600 text-white"
                  : "border-marca-200 text-marca-700 hover:bg-marca-50"
              }`}
            >
              <CheckCircle2 size={26} /> Eu vou
            </button>
            <button
              onClick={() => rsvp("talvez")}
              disabled={salvando}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 font-semibold transition ${
                evento.meu_rsvp === "talvez"
                  ? "border-ouro-500 bg-ouro-500 text-marca-900"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <HelpCircle size={26} /> Talvez
            </button>
            <button
              onClick={() => rsvp("cancelado")}
              disabled={salvando}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 font-semibold transition ${
                evento.meu_rsvp === "cancelado"
                  ? "border-red-400 bg-red-100 text-red-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <XCircle size={26} /> Não vou
            </button>
          </div>
        </Card>
      )}

      {/* Aprovação (liderança) */}
      {evento.posso_aprovar && evento.status === "pendente" && (
        <Card className="border-ouro-400 bg-amber-50 p-4">
          <h2 className="mb-3 font-bold text-amber-900">Aprovar este evento?</h2>
          <div className="flex gap-3">
            <Botao full onClick={aprovar}>
              <Check size={20} /> Aprovar
            </Botao>
            <Botao variante="perigo" full onClick={() => setModalRejeitar(true)}>
              <X size={20} /> Rejeitar
            </Botao>
          </div>
        </Card>
      )}

      {/* Ações do criador/liderança */}
      {podeGerir && (
        <div className="flex gap-3">
          <Link to={`/evento/${evento.id}/editar`} className="flex-1">
            <Botao variante="secondary" full>
              <Pencil size={18} /> Editar
            </Botao>
          </Link>
          <UploadFoto
            endpoint={`/api/eventos/${evento.id}/foto/`}
            onPronto={setEvento}
            className="btn-secondary !px-4"
          >
            <ImageIcon size={18} />
          </UploadFoto>
          <Botao variante="ghost" onClick={() => setConfirmarExcluir(true)}>
            <Trash2 size={18} className="text-red-500" />
          </Botao>
        </div>
      )}

      {/* Participantes */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-800">
          <Users size={20} className="text-marca-600" />
          Confirmados ({participantes.length})
        </h2>
        {participantes.length ? (
          <div className="flex flex-wrap gap-2">
            {participantes.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm"
              >
                <Avatar nome={p.usuario_detalhe.nome} foto={p.usuario_detalhe.foto} size={28} />
                <span className="text-sm font-medium text-slate-700">
                  {p.usuario_detalhe.nome}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Vazio titulo="Ninguém confirmou ainda" descricao="Seja o primeiro a confirmar!" />
        )}
      </section>

      <Confirmacao
        aberto={confirmarExcluir}
        aoFechar={() => setConfirmarExcluir(false)}
        aoConfirmar={excluir}
        titulo="Excluir evento"
        mensagem="Tem certeza? Esta ação não pode ser desfeita."
        confirmarTexto="Excluir"
        perigo
      />

      <Modal
        aberto={modalRejeitar}
        aoFechar={() => setModalRejeitar(false)}
        titulo="Rejeitar evento"
        rodape={
          <>
            <Botao variante="ghost" full onClick={() => setModalRejeitar(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" full onClick={rejeitar}>
              Rejeitar
            </Botao>
          </>
        }
      >
        <label className="label">Motivo (opcional)</label>
        <textarea
          className="input min-h-[100px]"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Explique por que o evento não foi aprovado..."
        />
      </Modal>
    </div>
  );
}
