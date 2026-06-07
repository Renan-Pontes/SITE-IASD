import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, LogIn, Check, X, Plus, Camera } from "lucide-react";
import { UploadFoto } from "../components/UploadFoto";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Evento, Grupo, GrupoMembro, Mensagem, Paginated } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar, Vazio, SkeletonLista } from "../ui/components";
import { EventoCard } from "../components/EventoCard";
import { rotulo, formatHora, formatDataCurta } from "../lib/format";

type Aba = "chat" | "eventos" | "membros";

export default function GrupoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { me, recarregar } = useAuth();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [aba, setAba] = useState<Aba>("chat");

  const recarregarGrupo = () => api.get<Grupo>(`/api/grupos/${id}/`).then(setGrupo);
  useEffect(() => {
    recarregarGrupo();
  }, [id]);

  const souMembro = grupo?.meu_status === "ativo";
  const souLider =
    grupo?.meu_cargo === "lider" ||
    grupo?.meu_cargo === "diretor" ||
    (grupo && me?.vinculos_igreja.some((v) => v.igreja === grupo.igreja && v.eh_lideranca));

  const entrar = async () => {
    try {
      await api.post(`/api/grupos/${id}/entrar/`);
      toast.sucesso("Pedido enviado! Aguarde a aprovação.");
      recarregarGrupo();
      recarregar();
    } catch {
      toast.erro("Não foi possível enviar o pedido.");
    }
  };

  if (!grupo) return <Carregando />;

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>

      <Card className="overflow-hidden">
        {grupo.foto && (
          <img src={grupo.foto} alt={grupo.nome} className="h-40 w-full object-cover" />
        )}
        <div className="bg-gradient-to-br from-marca-600 to-marca-800 p-6 text-white">
          <Badge cor="ouro">{rotulo.tipoGrupo(grupo.tipo)}</Badge>
          <h1 className="mt-2 text-2xl font-extrabold">{grupo.nome}</h1>
          <Link to={`/igreja/${grupo.igreja}`} className="text-marca-50 hover:underline">
            {grupo.igreja_nome}
          </Link>
        </div>
        <div className="p-4">
          {grupo.descricao && <p className="mb-3 text-slate-600">{grupo.descricao}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {grupo.meu_status === "ativo" ? (
              <Badge cor="marca">{rotulo.cargo(grupo.meu_cargo || "membro")}</Badge>
            ) : grupo.meu_status === "pendente" ? (
              <Badge cor="ouro">Aguardando aprovação</Badge>
            ) : (
              <Botao onClick={entrar}>
                <LogIn size={18} /> Pedir para entrar
              </Botao>
            )}
            {souLider && (
              <UploadFoto endpoint={`/api/grupos/${grupo.id}/foto/`} onPronto={setGrupo}>
                <Camera size={18} /> Foto
              </UploadFoto>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([
          ["chat", "Chat"],
          ["eventos", "Eventos"],
          ["membros", "Membros"],
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

      {aba === "chat" && <Chat grupoId={Number(id)} podeVer={!!souMembro || !!souLider} />}
      {aba === "eventos" && <EventosGrupo grupoId={Number(id)} />}
      {aba === "membros" && (
        <Membros grupoId={Number(id)} souLider={!!souLider} aoMudar={recarregarGrupo} />
      )}
    </div>
  );
}

function Chat({ grupoId, podeVer }: { grupoId: number; podeVer: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const fimRef = useRef<HTMLDivElement>(null);
  const ultimoId = useRef(0);

  // Mescla mensagens novas evitando duplicatas, mantendo ordem por id.
  const mesclar = (novas: Mensagem[]) => {
    if (!novas.length) return;
    setMensagens((atuais) => {
      const vistos = new Set(atuais.map((m) => m.id));
      const extras = novas.filter((m) => !vistos.has(m.id));
      if (!extras.length) return atuais;
      ultimoId.current = Math.max(ultimoId.current, ...extras.map((m) => m.id));
      return [...atuais, ...extras];
    });
  };

  useEffect(() => {
    if (!podeVer) {
      setCarregando(false);
      return;
    }
    let vivo = true;

    // Carga inicial completa.
    api
      .get<Mensagem[]>(`/api/grupos/${grupoId}/mensagens/`)
      .then((m) => {
        if (!vivo) return;
        setMensagens(m);
        ultimoId.current = m.length ? m[m.length - 1].id : 0;
        setCarregando(false);
      })
      .catch(() => setCarregando(false));

    // Polling incremental (só busca mensagens novas, e pausa com a aba oculta).
    const buscarNovas = () => {
      if (document.hidden) return;
      api
        .get<Mensagem[]>(`/api/grupos/${grupoId}/mensagens/?depois_de=${ultimoId.current}`)
        .then((novas) => vivo && mesclar(novas))
        .catch(() => {});
    };
    const t = setInterval(buscarNovas, 4000);
    const aoVoltar = () => !document.hidden && buscarNovas();
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [grupoId, podeVer]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) return;
    setTexto("");
    try {
      const msg = await api.post<Mensagem>(`/api/grupos/${grupoId}/mensagens/`, { conteudo });
      mesclar([msg]);
    } catch {
      toast.erro("Não foi possível enviar.");
      setTexto(conteudo);
    }
  };

  if (!podeVer)
    return (
      <Vazio
        titulo="Chat exclusivo do grupo"
        descricao="Entre no grupo para ver e participar das conversas."
      />
    );
  if (carregando) return <SkeletonLista n={3} />;

  return (
    <div className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-3">
        {mensagens.length === 0 && (
          <p className="py-8 text-center text-slate-400">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}
        {mensagens.map((m) => {
          const meu = m.autor === me?.profile.id;
          return (
            <div key={m.id} className={`flex gap-2 ${meu ? "flex-row-reverse" : ""}`}>
              {!meu && <Avatar nome={m.autor_detalhe.nome} foto={m.autor_detalhe.foto} size={32} />}
              <div className={`max-w-[75%] ${meu ? "items-end" : ""}`}>
                {!meu && (
                  <span className="ml-1 text-xs font-semibold text-slate-500">
                    {m.autor_detalhe.nome}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    meu ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.conteudo}
                </div>
                <span className={`block text-[10px] text-slate-400 ${meu ? "text-right" : "ml-1"}`}>
                  {formatDataCurta(m.criado_em)} {formatHora(m.criado_em)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>
      <form onSubmit={enviar} className="mt-2 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Escreva uma mensagem..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="btn-primary !px-4" aria-label="Enviar">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

function EventosGrupo({ grupoId }: { grupoId: number }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    api
      .get<Paginated<Evento>>(`/api/eventos/?grupo=${grupoId}&ordering=inicio`)
      .then((d) => setEventos(d.results))
      .finally(() => setCarregando(false));
  }, [grupoId]);

  if (carregando) return <SkeletonLista n={2} />;
  return (
    <div className="space-y-3">
      <Link to="/evento/novo" className="block">
        <Botao variante="secondary" full>
          <Plus size={18} /> Criar evento do grupo
        </Botao>
      </Link>
      {eventos.length ? (
        eventos.map((ev) => <EventoCard key={ev.id} evento={ev} />)
      ) : (
        <Vazio titulo="Nenhum evento do grupo" />
      )}
    </div>
  );
}

function Membros({
  grupoId,
  souLider,
  aoMudar,
}: {
  grupoId: number;
  souLider: boolean;
  aoMudar: () => void;
}) {
  const toast = useToast();
  const [membros, setMembros] = useState<GrupoMembro[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    setCarregando(true);
    const sufixo = souLider ? "?status=" : "";
    api
      .get<GrupoMembro[]>(`/api/grupos/${grupoId}/membros/${sufixo}`)
      .then(setMembros)
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [grupoId, souLider]);

  const acao = async (gmId: number, tipo: "aprovar" | "rejeitar") => {
    try {
      await api.post(`/api/grupo-membros/${gmId}/${tipo}/`);
      toast.sucesso(tipo === "aprovar" ? "Membro aprovado!" : "Pedido recusado.");
      carregar();
      aoMudar();
    } catch {
      toast.erro("Erro ao processar.");
    }
  };

  const mudarCargo = async (gmId: number, cargo: string) => {
    try {
      await api.post(`/api/grupo-membros/${gmId}/definir_cargo/`, { cargo });
      toast.sucesso("Cargo atualizado.");
      carregar();
    } catch {
      toast.erro("Erro ao atualizar cargo.");
    }
  };

  if (carregando) return <SkeletonLista n={3} />;
  const pendentes = membros.filter((m) => m.status === "pendente");
  const ativos = membros.filter((m) => m.status === "ativo");

  return (
    <div className="space-y-4">
      {souLider && pendentes.length > 0 && (
        <section>
          <h3 className="mb-2 font-bold text-amber-800">Pedidos pendentes</h3>
          <div className="space-y-2">
            {pendentes.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3">
                <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={40} />
                <span className="flex-1 font-medium text-slate-700">{m.usuario_detalhe.nome}</span>
                <button
                  onClick={() => acao(m.id, "aprovar")}
                  className="rounded-full bg-marca-600 p-2 text-white"
                  aria-label="Aprovar"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => acao(m.id, "rejeitar")}
                  className="rounded-full bg-red-100 p-2 text-red-600"
                  aria-label="Rejeitar"
                >
                  <X size={18} />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 font-bold text-slate-600">Membros ({ativos.length})</h3>
        <div className="space-y-2">
          {ativos.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 p-3">
              <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={40} />
              <span className="flex-1 font-medium text-slate-700">{m.usuario_detalhe.nome}</span>
              {souLider ? (
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  value={m.cargo}
                  onChange={(e) => mudarCargo(m.id, e.target.value)}
                >
                  <option value="membro">Membro</option>
                  <option value="secretario">Secretário</option>
                  <option value="lider">Líder</option>
                  <option value="diretor">Diretor</option>
                </select>
              ) : (
                <Badge cor="cinza">{rotulo.cargo(m.cargo)}</Badge>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
