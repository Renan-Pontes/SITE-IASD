import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, LogIn, Check, X, Plus, Camera, BarChart3, Clock, Lock } from "lucide-react";
import { UploadFoto } from "../components/UploadFoto";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { EnqueteGrupo, Evento, Grupo, GrupoMembro, Mensagem, Paginated } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar, Vazio, SkeletonLista } from "../ui/components";
import { EventoCard } from "../components/EventoCard";
import { RejeitarModal } from "../components/RejeitarModal";
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

  const motivoRejGrupo = me?.vinculos_grupo.find((v) => v.grupo === grupo.id)?.motivo_rejeicao;

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
        <div className="space-y-3 p-4">
          {grupo.descricao && <p className="text-slate-600 dark:text-slate-300">{grupo.descricao}</p>}

          {grupo.meu_status === "pendente" && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              ⏳ <b>Solicitação enviada.</b> Aguarde a aprovação do líder do grupo —
              você será avisado.
            </div>
          )}
          {grupo.meu_status === "rejeitado" && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <b>Solicitação não aprovada.</b>
              {motivoRejGrupo ? ` Motivo: ${motivoRejGrupo}` : ""}
              <Botao variante="secondary" className="mt-2" onClick={entrar}>
                <LogIn size={18} /> Pedir novamente
              </Botao>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {grupo.meu_status === "ativo" && (
              <Badge cor="marca">{rotulo.cargo(grupo.meu_cargo || "membro")}</Badge>
            )}
            {(!grupo.meu_status || grupo.meu_status === "inativo") && (
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

      {aba === "chat" && (
        <Chat grupoId={Number(id)} podeVer={!!souMembro || !!souLider} souLider={!!souLider} />
      )}
      {aba === "eventos" && <EventosGrupo grupoId={Number(id)} podeCriar={!!souLider} />}
      {aba === "membros" && (
        <Membros grupoId={Number(id)} souLider={!!souLider} aoMudar={recarregarGrupo} />
      )}
    </div>
  );
}

function Chat({
  grupoId,
  podeVer,
  souLider,
}: {
  grupoId: number;
  podeVer: boolean;
  souLider: boolean;
}) {
  const { me } = useAuth();
  const toast = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [criandoEnquete, setCriandoEnquete] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const ultimoId = useRef(0);

  // Substitui a enquete embutida numa mensagem (após votar / encerrar).
  const atualizarEnquete = (enq: EnqueteGrupo) =>
    setMensagens((atuais) =>
      atuais.map((m) =>
        m.enquete === enq.id ? { ...m, enquete_detalhe: enq } : m,
      ),
    );

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
          if (m.enquete_detalhe) {
            return (
              <EnquetePoll
                key={m.id}
                enquete={m.enquete_detalhe}
                souLider={souLider}
                meuId={me?.profile.id}
                aoMudar={atualizarEnquete}
              />
            );
          }
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
        <button
          type="button"
          onClick={() => setCriandoEnquete(true)}
          className="rounded-xl bg-slate-100 px-3 text-slate-500 hover:bg-slate-200"
          aria-label="Criar enquete"
          title="Criar enquete"
        >
          <BarChart3 size={20} />
        </button>
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

      {criandoEnquete && (
        <CriarEnqueteModal
          grupoId={grupoId}
          aoFechar={() => setCriandoEnquete(false)}
          aoCriar={(msg) => {
            mesclar([msg]);
            setCriandoEnquete(false);
          }}
        />
      )}
    </div>
  );
}

function EnquetePoll({
  enquete,
  souLider,
  meuId,
  aoMudar,
}: {
  enquete: EnqueteGrupo;
  souLider: boolean;
  meuId?: number;
  aoMudar: (e: EnqueteGrupo) => void;
}) {
  const toast = useToast();
  const fechada = enquete.encerrada;
  const souAutor = enquete.criada_por === meuId;

  // Atualiza os resultados periodicamente enquanto a enquete está aberta.
  useEffect(() => {
    if (fechada) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      api.get<EnqueteGrupo>(`/api/enquetes/${enquete.id}/`).then(aoMudar).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [enquete.id, fechada]);

  const votar = async (opcaoId: number) => {
    if (fechada) return;
    let proximo: number[];
    if (enquete.multipla_escolha) {
      proximo = enquete.meu_voto.includes(opcaoId)
        ? enquete.meu_voto.filter((i) => i !== opcaoId)
        : [...enquete.meu_voto, opcaoId];
    } else {
      proximo = enquete.meu_voto.includes(opcaoId) ? [] : [opcaoId];
    }
    try {
      const atualizada = await api.post<EnqueteGrupo>(`/api/enquetes/${enquete.id}/votar/`, {
        opcoes: proximo,
      });
      aoMudar(atualizada);
    } catch {
      toast.erro("Não foi possível registrar o voto.");
    }
  };

  const encerrar = async () => {
    try {
      const atualizada = await api.post<EnqueteGrupo>(`/api/enquetes/${enquete.id}/encerrar/`);
      aoMudar(atualizada);
      toast.info("Enquete encerrada.");
    } catch {
      toast.erro("Não foi possível encerrar.");
    }
  };

  const maxVotos = Math.max(1, ...enquete.opcoes.map((o) => o.votos));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
        <BarChart3 size={14} />
        <span>
          Enquete de {enquete.criada_por_detalhe?.nome}
          {enquete.anonima ? " · anônima" : ""}
          {enquete.multipla_escolha ? " · múltipla escolha" : ""}
        </span>
      </div>
      <p className="font-bold text-slate-800">{enquete.pergunta}</p>

      <div className="mt-3 space-y-2">
        {enquete.opcoes.map((o) => {
          const pct = enquete.total_votos ? Math.round((o.votos / enquete.total_votos) * 100) : 0;
          const escolhida = enquete.meu_voto.includes(o.id);
          const vencedora = fechada && o.votos === maxVotos && o.votos > 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => votar(o.id)}
              disabled={fechada}
              className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${
                escolhida ? "border-marca-500 bg-marca-50" : "border-slate-200 bg-white"
              } ${fechada ? "cursor-default" : "hover:border-marca-300"}`}
            >
              <span
                className={`absolute inset-y-0 left-0 ${vencedora ? "bg-marca-200/70" : "bg-slate-100"}`}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  {escolhida && <Check size={15} className="text-marca-600" />}
                  {o.texto}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {o.votos} · {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {enquete.total_votos} {enquete.total_votos === 1 ? "voto" : "votos"}
          {fechada ? (
            <span className="ml-1 inline-flex items-center gap-1 text-rose-500">
              <Lock size={12} /> encerrada
            </span>
          ) : enquete.prazo ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <Clock size={12} /> até {formatDataCurta(enquete.prazo)} {formatHora(enquete.prazo)}
            </span>
          ) : null}
        </span>
        {!fechada && (souAutor || souLider) && (
          <button onClick={encerrar} className="font-semibold text-rose-500 hover:underline">
            Encerrar
          </button>
        )}
      </div>
    </div>
  );
}

function CriarEnqueteModal({
  grupoId,
  aoFechar,
  aoCriar,
}: {
  grupoId: number;
  aoFechar: () => void;
  aoCriar: (m: Mensagem) => void;
}) {
  const toast = useToast();
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState(["", ""]);
  const [multipla, setMultipla] = useState(false);
  const [anonima, setAnonima] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const mudarOpcao = (i: number, v: string) =>
    setOpcoes((arr) => arr.map((o, j) => (j === i ? v : o)));
  const addOpcao = () => setOpcoes((arr) => (arr.length >= 10 ? arr : [...arr, ""]));
  const removerOpcao = (i: number) =>
    setOpcoes((arr) => (arr.length <= 2 ? arr : arr.filter((_, j) => j !== i)));

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!pergunta.trim()) return toast.erro("Escreva a pergunta.");
    if (limpas.length < 2) return toast.erro("Inclua ao menos duas opções.");
    setSalvando(true);
    try {
      const msg = await api.post<Mensagem>("/api/enquetes/", {
        grupo: grupoId,
        pergunta: pergunta.trim(),
        opcoes: limpas,
        multipla_escolha: multipla,
        anonima,
        prazo: prazo ? new Date(prazo).toISOString() : null,
      });
      aoCriar(msg);
    } catch {
      toast.erro("Não foi possível criar a enquete.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <BarChart3 size={20} /> Nova enquete
          </h2>
          <button onClick={aoFechar} aria-label="Fechar" className="text-slate-400">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={criar} className="space-y-3">
          <input
            className="input"
            placeholder="Pergunta (ex.: Qual dia para o piquenique?)"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            autoFocus
          />
          <div className="space-y-2">
            {opcoes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={`Opção ${i + 1}`}
                  value={o}
                  onChange={(e) => mudarOpcao(i, e.target.value)}
                />
                {opcoes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removerOpcao(i)}
                    className="rounded-lg bg-slate-100 px-2 text-slate-400"
                    aria-label="Remover opção"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            {opcoes.length < 10 && (
              <button
                type="button"
                onClick={addOpcao}
                className="flex items-center gap-1 text-sm font-semibold text-marca-700"
              >
                <Plus size={16} /> Adicionar opção
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={multipla} onChange={(e) => setMultipla(e.target.checked)} />
            Permitir múltiplas escolhas
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} />
            Anônima (não mostra quem votou)
          </label>
          <div>
            <span className="label">Prazo (opcional)</span>
            <input
              type="datetime-local"
              className="input"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>

          <Botao type="submit" full carregando={salvando}>
            Publicar enquete
          </Botao>
        </form>
      </div>
    </div>
  );
}

function EventosGrupo({ grupoId, podeCriar }: { grupoId: number; podeCriar: boolean }) {
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
      {/* Só o líder/diretor do grupo cria eventos. */}
      {podeCriar && (
        <Link to="/evento/novo" className="block">
          <Botao variante="secondary" full>
            <Plus size={18} /> Criar evento do grupo
          </Botao>
        </Link>
      )}
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
  const [rejeitarId, setRejeitarId] = useState<number | null>(null);

  const carregar = () => {
    setCarregando(true);
    const sufixo = souLider ? "?status=" : "";
    api
      .get<GrupoMembro[]>(`/api/grupos/${grupoId}/membros/${sufixo}`)
      .then(setMembros)
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [grupoId, souLider]);

  const aprovar = async (gmId: number) => {
    try {
      await api.post(`/api/grupo-membros/${gmId}/aprovar/`);
      toast.sucesso("Membro aprovado!");
      carregar();
      aoMudar();
    } catch {
      toast.erro("Erro ao processar.");
    }
  };

  const confirmarRejeicao = async (motivo: string) => {
    if (rejeitarId == null) return;
    const id = rejeitarId;
    setRejeitarId(null);
    try {
      await api.post(`/api/grupo-membros/${id}/rejeitar/`, { motivo });
      toast.info("Pedido recusado.");
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
                  onClick={() => aprovar(m.id)}
                  className="rounded-full bg-marca-600 p-2 text-white"
                  aria-label="Aprovar"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setRejeitarId(m.id)}
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

      <RejeitarModal
        aberto={rejeitarId != null}
        aoFechar={() => setRejeitarId(null)}
        aoConfirmar={confirmarRejeicao}
      />
    </div>
  );
}
