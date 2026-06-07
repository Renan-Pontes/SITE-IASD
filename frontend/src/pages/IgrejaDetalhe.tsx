import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapPin, Phone, Settings, ShieldCheck, LogIn, Clock3 } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Evento, Grupo, Igreja, Membro, Paginated } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar, Vazio, SkeletonLista } from "../ui/components";
import { EventoCard } from "../components/EventoCard";
import { rotulo } from "../lib/format";

type Aba = "agenda" | "grupos" | "lideranca";

export default function IgrejaDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { logado, lideroIgreja, recarregar } = useAuth();
  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [aba, setAba] = useState<Aba>("agenda");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [lideranca, setLideranca] = useState<Membro[]>([]);
  const [carregandoAba, setCarregandoAba] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const recarregarIgreja = () =>
    api.get<Igreja>(`/api/igrejas/${id}/`).then(setIgreja);

  useEffect(() => {
    recarregarIgreja();
  }, [id]);

  useEffect(() => {
    if (!igreja) return;
    setCarregandoAba(true);
    if (aba === "agenda") {
      api
        .get<Paginated<Evento>>(`/api/eventos/?igreja=${id}&status=aprovado&proximos=true&ordering=inicio`)
        .then((d) => setEventos(d.results))
        .finally(() => setCarregandoAba(false));
    } else if (aba === "grupos") {
      api
        .get<Grupo[]>(`/api/igrejas/${id}/grupos/`)
        .then(setGrupos)
        .finally(() => setCarregandoAba(false));
    } else {
      api
        .get<Membro[]>(`/api/igrejas/${id}/lideranca/`)
        .then(setLideranca)
        .finally(() => setCarregandoAba(false));
    }
  }, [aba, igreja, id]);

  const entrar = async () => {
    if (!logado) {
      nav("/entrar", { state: { de: `/igreja/${id}` } });
      return;
    }
    setEntrando(true);
    try {
      await api.post(`/api/igrejas/${id}/entrar/`);
      toast.sucesso("Pedido enviado! Aguarde a aprovação da liderança.");
      await recarregarIgreja();
      await recarregar();
    } catch {
      toast.erro("Não foi possível enviar o pedido.");
    } finally {
      setEntrando(false);
    }
  };

  if (!igreja) return <Carregando />;
  const sou = lideroIgreja(igreja.id);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-marca-600 to-marca-800 p-6 text-white">
          <h1 className="text-2xl font-extrabold">{igreja.nome}</h1>
          <div className="mt-2 space-y-1 text-marca-50">
            {(igreja.endereco || igreja.cidade) && (
              <a
                href={
                  igreja.latitude
                    ? `https://www.google.com/maps?q=${igreja.latitude},${igreja.longitude}`
                    : `https://www.google.com/maps/search/${encodeURIComponent(igreja.nome + " " + igreja.cidade)}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:underline"
              >
                <MapPin size={18} />
                {igreja.endereco ? `${igreja.endereco} — ` : ""}
                {igreja.cidade}
                {igreja.estado && `/${igreja.estado}`}
              </a>
            )}
            {igreja.telefone && (
              <a href={`tel:${igreja.telefone}`} className="flex items-center gap-2 hover:underline">
                <Phone size={18} /> {igreja.telefone}
              </a>
            )}
          </div>
        </div>
        <div className="p-4">
          {igreja.descricao && <p className="mb-3 text-slate-600">{igreja.descricao}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {igreja.meu_status === "ativo" ? (
              <Badge cor="marca">
                <ShieldCheck size={14} /> {rotulo.papel(igreja.meu_papel || "membro")}
              </Badge>
            ) : igreja.meu_status === "pendente" ? (
              <Badge cor="ouro">
                <Clock3 size={14} /> Aguardando aprovação
              </Badge>
            ) : (
              <Botao onClick={entrar} carregando={entrando}>
                <LogIn size={18} /> Entrar nesta igreja
              </Botao>
            )}
            {sou && (
              <Link to={`/admin/igreja/${igreja.id}`}>
                <Botao variante="secondary">
                  <Settings size={18} /> Administrar
                </Botao>
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Abas */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([
          ["agenda", "Agenda"],
          ["grupos", "Grupos"],
          ["lideranca", "Liderança"],
        ] as [Aba, string][]).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              aba === k ? "bg-white text-marca-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {carregandoAba ? (
        <SkeletonLista n={2} />
      ) : aba === "agenda" ? (
        eventos.length ? (
          <div className="space-y-3">
            {eventos.map((ev) => (
              <EventoCard key={ev.id} evento={ev} />
            ))}
          </div>
        ) : (
          <Vazio titulo="Sem eventos futuros" descricao="Esta igreja ainda não publicou eventos." />
        )
      ) : aba === "grupos" ? (
        grupos.length ? (
          <div className="space-y-3">
            {grupos.map((g) => (
              <Link key={g.id} to={`/grupo/${g.id}`}>
                <Card className="flex items-center justify-between p-4 hover:shadow-md">
                  <div>
                    <h3 className="font-bold text-slate-800">{g.nome}</h3>
                    <p className="text-sm text-slate-500">
                      {rotulo.tipoGrupo(g.tipo)} • {g.total_membros} membros
                    </p>
                  </div>
                  {g.meu_status === "ativo" && <Badge cor="marca">Membro</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Vazio titulo="Nenhum grupo" descricao="Esta igreja ainda não cadastrou grupos." />
        )
      ) : lideranca.length ? (
        <div className="space-y-3">
          {lideranca.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 p-4">
              <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} />
              <div>
                <h3 className="font-semibold text-slate-800">{m.usuario_detalhe.nome}</h3>
                <Badge cor="marca">{rotulo.papel(m.papel)}</Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Vazio titulo="Liderança não cadastrada" />
      )}
    </div>
  );
}
