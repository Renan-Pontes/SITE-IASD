import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Vote, Lock, Clock3, CheckCircle2, XCircle, Gavel, ShieldCheck,
  Building2, Users as UsersIcon, DoorOpen, CalendarPlus, ListChecks, MessageSquare,
} from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Igreja, Pauta, Paginated, TipoPauta } from "../lib/types";
import { Botao, Card, Carregando, Badge, Vazio, Campo } from "../ui/components";
import { Modal } from "../ui/Modal";
import { formatData, rotulo } from "../lib/format";

const METODO_DICA: Record<string, string> = {
  maioria_simples: "Mais 'sim' que 'não'. Padrão para o dia a dia.",
  unanimidade: "Todos os anciões precisam concordar. Um 'não' rejeita na hora.",
  maioria_absoluta: "Mais da metade de TODOS os anciões precisa votar 'sim'.",
  dois_tercos: "Pelo menos 2/3 dos votos precisam ser 'sim'.",
  quorum_aprovacao: "Aprova ao atingir o número de 'sim' definido no Quórum.",
  lider: "Um único 'sim' já aprova. Para coisas simples.",
};

const TIPOS: { tipo: TipoPauta; label: string; icone: any; dica: string }[] = [
  { tipo: "alteracao_igreja", label: "Alterar igreja", icone: Building2, dica: "Mudar dados da igreja" },
  { tipo: "criar_grupo", label: "Criar grupo", icone: UsersIcon, dica: "Novo ministério/classe" },
  { tipo: "criar_sala", label: "Criar sala", icone: DoorOpen, dica: "Novo local/sala" },
  { tipo: "agendar_evento", label: "Agendar evento", icone: CalendarPlus, dica: "Programação da igreja" },
  { tipo: "enquete_livre", label: "Enquete", icone: ListChecks, dica: "Pergunta com opções" },
  { tipo: "outra", label: "Deliberação", icone: MessageSquare, dica: "Sim / Não / Abstenção" },
];

// No Canal da Liderança os líderes deliberam, mas NÃO gerem a programação
// da igreja — então só deliberação e enquete (sem criar grupo/sala/evento).
const TIPOS_LIDERANCA: TipoPauta[] = ["outra", "enquete_livre"];

export default function Canal() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const canal = params.get("canal") === "lideranca" ? "lideranca" : "anciaos";
  const { lideroIgreja, souLiderIgreja, carregando: authLoad } = useAuth();
  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criar, setCriar] = useState(false);

  const carregar = () => {
    setCarregando(true);
    api
      .get<Paginated<Pauta>>(`/api/pautas/?igreja=${id}&canal=${canal}&ordering=-criado_em`)
      .then((d) => setPautas(d.results))
      .finally(() => setCarregando(false));
  };
  useEffect(() => {
    api.get<Igreja>(`/api/igrejas/${id}/`).then(setIgreja).catch(() => {});
    carregar();
  }, [id, canal]);

  if (authLoad || !igreja) return <Carregando />;

  const souAnciao = lideroIgreja(igreja.id);
  const souLider = souLiderIgreja(igreja.id);
  const podeAnciaos = souAnciao;
  const podeLideranca = souLider || souAnciao;
  const temAcesso = canal === "lideranca" ? podeLideranca : podeAnciaos;
  if (!temAcesso) {
    // Líder de igreja que cai no canal dos anciões vai para o seu canal.
    if (canal === "anciaos" && podeLideranca)
      return <Navigate to={`/igreja/${id}/canal?canal=lideranca`} replace />;
    return <Navigate to={`/igreja/${id}`} replace />;
  }

  const eLideranca = canal === "lideranca";
  const abertas = pautas.filter((p) => p.status === "aberta");
  const encerradas = pautas.filter((p) => p.status === "encerrada");

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            {eLideranca ? (
              <><ShieldCheck className="text-marca-600" /> Canal da Liderança</>
            ) : (
              <><Gavel className="text-marca-600" /> Canal dos Anciões</>
            )}
          </h1>
          <p className="text-slate-500">{igreja.nome}</p>
        </div>
      </div>

      {podeAnciaos && podeLideranca && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([
            ["anciaos", "Anciões"],
            ["lideranca", "Liderança"],
          ] as const).map(([k, t]) => (
            <Link
              key={k}
              to={`/igreja/${id}/canal?canal=${k}`}
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition ${
                canal === k ? "bg-white text-marca-700 shadow-sm dark:bg-slate-700 dark:text-marca-300" : "text-slate-500"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {eLideranca && (
        <p className="rounded-xl bg-marca-50 p-3 text-sm text-marca-800 dark:bg-marca-900/20 dark:text-marca-200">
          Espaço dos <b>líderes de igreja</b> para deliberar e consultar. Os anciões
          podem opinar/votar, mas o voto deles é consultivo (não conta para o quórum).
        </p>
      )}

      <Botao full onClick={() => setCriar(true)}>
        <Plus size={18} /> Criar nova pauta
      </Botao>

      {carregando ? (
        <Carregando />
      ) : (
        <>
          <section>
            <h2 className="mb-2 font-bold text-slate-700 dark:text-slate-200">
              Pautas abertas ({abertas.length})
            </h2>
            {abertas.length === 0 ? (
              <Vazio
                titulo="Nenhuma pauta aberta"
                descricao={
                  eLideranca
                    ? "Crie uma proposta para os líderes votarem."
                    : "Crie uma proposta para os anciões votarem."
                }
                icone={<Vote size={48} />}
              />
            ) : (
              <div className="space-y-3">
                {abertas.map((p) => (
                  <PautaCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>

          {encerradas.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold text-slate-700 dark:text-slate-200">Histórico</h2>
              <div className="space-y-3">
                {encerradas.map((p) => (
                  <PautaCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <CriarPautaCanal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        igreja={igreja}
        canal={canal}
        aoCriar={() => {
          setCriar(false);
          carregar();
        }}
      />
    </div>
  );
}

function PautaCard({ p }: { p: Pauta }) {
  const encerrada = p.status === "encerrada";
  return (
    <Link to={`/pauta/${p.id}`}>
      <Card className="p-4 hover:shadow-md">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge cor="azul">{rotulo.tipoPauta(p.tipo)}</Badge>
          {p.anonima && (
            <Badge cor="cinza">
              <Lock size={12} /> Secreta
            </Badge>
          )}
          {encerrada ? (
            <Badge cor={p.decisao === "aprovado" ? "marca" : p.decisao === "rejeitado" ? "vermelho" : "cinza"}>
              {p.decisao === "aprovado" ? (
                <><CheckCircle2 size={12} /> Aprovada</>
              ) : p.decisao === "rejeitado" ? (
                <><XCircle size={12} /> Rejeitada</>
              ) : (
                <>Encerrada{p.decisao ? `: ${p.decisao}` : ""}</>
              )}
            </Badge>
          ) : (
            <Badge cor="marca">Aberta</Badge>
          )}
          {p.aplicada_em && <Badge cor="ouro">✓ Aplicada</Badge>}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
        <p className="text-sm text-slate-500">
          {p.total_votos} voto{p.total_votos !== 1 ? "s" : ""}
          {p.quorum_minimo ? ` • quórum ${p.total_votos}/${p.quorum_minimo}` : ""}
        </p>
        {p.prazo_votacao && !encerrada && (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Clock3 size={13} /> Prazo: {formatData(p.prazo_votacao)}
          </p>
        )}
      </Card>
    </Link>
  );
}

function CriarPautaCanal({
  aberto, aoFechar, igreja, canal, aoCriar,
}: {
  aberto: boolean; aoFechar: () => void; igreja: Igreja; canal: "anciaos" | "lideranca"; aoCriar: () => void;
}) {
  const toast = useToast();
  const eLideranca = canal === "lideranca";
  const tiposDisponiveis = eLideranca
    ? TIPOS.filter((t) => TIPOS_LIDERANCA.includes(t.tipo))
    : TIPOS;
  const [tipo, setTipo] = useState<TipoPauta | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Campos comuns
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quorum, setQuorum] = useState("");
  const [prazo, setPrazo] = useState("");
  const [anonima, setAnonima] = useState(false);
  const [justificativa, setJustificativa] = useState(true);
  const [metodo, setMetodo] = useState("maioria_simples");
  const [categoria, setCategoria] = useState("outros");
  const [anciaos, setAnciaos] = useState<string[]>([]);

  useEffect(() => {
    if (eLideranca) return; // eleitorado da liderança não vem deste endpoint
    api
      .get<any[]>(`/api/igrejas/${igreja.id}/lideranca/`)
      .then((ls) => setAnciaos(ls.map((m) => m.usuario_detalhe?.nome).filter(Boolean)))
      .catch(() => {});
  }, [igreja.id, eLideranca]);

  // Específicos
  const [grupo, setGrupo] = useState({ nome: "", tipo: "ministerio", descricao: "" });
  const [sala, setSala] = useState({ nome: "", capacidade: "", equipamentos: "" });
  const [evento, setEvento] = useState({ titulo: "", descricao: "", inicio: "", fim: "", visibilidade: "publico" });
  const [igrejaForm, setIgrejaForm] = useState({
    nome: "", descricao: "", endereco: "", cidade: "", estado: "", telefone: "", email: "",
  });
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);

  const reset = () => {
    setTipo(null); setTitulo(""); setDescricao(""); setQuorum(""); setPrazo("");
    setAnonima(false); setJustificativa(true); setMetodo("maioria_simples"); setCategoria("outros");
    setGrupo({ nome: "", tipo: "ministerio", descricao: "" });
    setSala({ nome: "", capacidade: "", equipamentos: "" });
    setEvento({ titulo: "", descricao: "", inicio: "", fim: "", visibilidade: "publico" });
    setOpcoes(["", ""]);
  };

  const escolherTipo = (t: TipoPauta) => {
    setTipo(t);
    if (t === "alteracao_igreja") {
      setIgrejaForm({
        nome: igreja.nome, descricao: igreja.descricao, endereco: igreja.endereco,
        cidade: igreja.cidade, estado: igreja.estado, telefone: igreja.telefone, email: igreja.email,
      });
      setTitulo("Alterar dados da igreja");
    } else {
      setTitulo(TIPOS.find((x) => x.tipo === t)?.label || "");
    }
  };

  const fechar = () => { reset(); aoFechar(); };

  const submeter = async () => {
    if (!tipo || !titulo.trim()) {
      toast.erro("Informe um título.");
      return;
    }
    const body: any = {
      titulo: titulo.trim(),
      descricao,
      igreja: igreja.id,
      tipo,
      categoria,
      canal,
      metodo_votacao: metodo,
      anonima,
      permitir_justificativa: justificativa,
      quorum_minimo: quorum ? Number(quorum) : null,
      prazo_votacao: prazo ? new Date(prazo).toISOString() : null,
    };
    if (tipo === "alteracao_igreja") {
      const depois: any = {};
      (Object.keys(igrejaForm) as (keyof typeof igrejaForm)[]).forEach((k) => {
        if (igrejaForm[k] !== (igreja as any)[k]) depois[k] = igrejaForm[k];
      });
      if (Object.keys(depois).length === 0) {
        toast.erro("Nenhuma alteração detectada.");
        return;
      }
      body.payload = { antes: igrejaForm, depois };
    } else if (tipo === "criar_grupo") {
      body.payload = grupo;
    } else if (tipo === "criar_sala") {
      body.payload = { ...sala, capacidade: sala.capacidade ? Number(sala.capacidade) : null };
    } else if (tipo === "agendar_evento") {
      if (!evento.inicio || !evento.fim) { toast.erro("Informe início e fim."); return; }
      body.payload = {
        titulo: evento.titulo || titulo, descricao: evento.descricao,
        inicio: new Date(evento.inicio).toISOString(), fim: new Date(evento.fim).toISOString(),
        visibilidade: evento.visibilidade,
      };
    } else if (tipo === "enquete_livre") {
      const ops = opcoes.map((o) => o.trim()).filter(Boolean);
      if (ops.length < 2) { toast.erro("Adicione pelo menos 2 opções."); return; }
      body.opcoes = ops;
    }

    setSalvando(true);
    try {
      await api.post("/api/pautas/", body);
      toast.sucesso(
        eLideranca ? "Pauta criada! Os líderes foram notificados." : "Pauta criada! Os anciões foram notificados.",
      );
      reset();
      aoCriar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao criar a pauta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={tipo ? "Nova pauta" : "Que tipo de pauta?"}
      rodape={
        tipo ? (
          <>
            <Botao variante="ghost" full onClick={() => setTipo(null)}>Voltar</Botao>
            <Botao full onClick={submeter} carregando={salvando}>Criar pauta</Botao>
          </>
        ) : undefined
      }
    >
      {!tipo ? (
        <div className="grid grid-cols-2 gap-2">
          {tiposDisponiveis.map(({ tipo: t, label, icone: Icone, dica }) => (
            <button
              key={t}
              onClick={() => escolherTipo(t)}
              className="flex flex-col items-start gap-1 rounded-xl border-2 border-slate-200 p-3 text-left hover:border-marca-400 hover:bg-marca-50 dark:border-slate-700"
            >
              <Icone className="text-marca-600" size={22} />
              <span className="font-bold text-slate-800 dark:text-slate-100">{label}</span>
              <span className="text-xs text-slate-400">{dica}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <Campo label="Título da pauta">
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo label="Descrição / justificativa">
            <textarea className="input min-h-[70px]" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>

          <Campo label="Método de votação">
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="maioria_simples">Maioria simples (mais sim que não)</option>
              <option value="unanimidade">Unanimidade (todos precisam concordar)</option>
              <option value="maioria_absoluta">Maioria absoluta (&gt;50% dos anciões)</option>
              <option value="dois_tercos">Dois terços dos votos</option>
              <option value="quorum_aprovacao">Quórum de aprovação (use o campo Quórum)</option>
              <option value="lider">Aprovação simples (1 sim já basta)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-400">{METODO_DICA[metodo]}</span>
          </Campo>

          {anciaos.length > 0 && (
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/50">
              Votarão: {anciaos.join(", ")} — {anciaos.length} ancião(s).
            </p>
          )}

          <Campo label="Categoria">
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="outros">Outros</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="programacao">Programação</option>
              <option value="financeiro">Financeiro</option>
              <option value="grupos">Grupos</option>
              <option value="pessoal">Pessoal</option>
            </select>
          </Campo>

          {tipo === "alteracao_igreja" && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500">Proposta de novos dados:</p>
              {(["nome", "descricao", "endereco", "cidade", "estado", "telefone", "email"] as const).map((k) => (
                <Campo key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                  <input className="input" value={(igrejaForm as any)[k]} onChange={(e) => setIgrejaForm({ ...igrejaForm, [k]: e.target.value })} />
                </Campo>
              ))}
            </div>
          )}

          {tipo === "criar_grupo" && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <Campo label="Nome do grupo"><input className="input" value={grupo.nome} onChange={(e) => setGrupo({ ...grupo, nome: e.target.value })} /></Campo>
              <Campo label="Tipo">
                <select className="input" value={grupo.tipo} onChange={(e) => setGrupo({ ...grupo, tipo: e.target.value })}>
                  <option value="ministerio">Ministério</option>
                  <option value="classe">Classe / Escola Sabatina</option>
                  <option value="desbravadores">Desbravadores</option>
                  <option value="aventureiros">Aventureiros</option>
                  <option value="musica">Música / Louvor</option>
                  <option value="jovens">Jovens</option>
                  <option value="outro">Outro</option>
                </select>
              </Campo>
            </div>
          )}

          {tipo === "criar_sala" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="col-span-2"><Campo label="Nome da sala"><input className="input" value={sala.nome} onChange={(e) => setSala({ ...sala, nome: e.target.value })} /></Campo></div>
              <Campo label="Capacidade"><input type="number" className="input" value={sala.capacidade} onChange={(e) => setSala({ ...sala, capacidade: e.target.value })} /></Campo>
              <Campo label="Equipamentos"><input className="input" value={sala.equipamentos} onChange={(e) => setSala({ ...sala, equipamentos: e.target.value })} /></Campo>
            </div>
          )}

          {tipo === "agendar_evento" && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <Campo label="Título do evento"><input className="input" value={evento.titulo} onChange={(e) => setEvento({ ...evento, titulo: e.target.value })} /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Início"><input type="datetime-local" className="input" value={evento.inicio} onChange={(e) => setEvento({ ...evento, inicio: e.target.value })} /></Campo>
                <Campo label="Fim"><input type="datetime-local" className="input" value={evento.fim} onChange={(e) => setEvento({ ...evento, fim: e.target.value })} /></Campo>
              </div>
            </div>
          )}

          {tipo === "enquete_livre" && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-xs font-semibold text-slate-500">Opções de resposta:</p>
              {opcoes.map((op, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input" placeholder={`Opção ${i + 1}`} value={op} onChange={(e) => setOpcoes(opcoes.map((x, j) => (j === i ? e.target.value : x)))} />
                  {opcoes.length > 2 && (
                    <button onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))} className="px-2 text-red-500" aria-label="Remover">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setOpcoes([...opcoes, ""])} className="text-sm font-semibold text-marca-700">+ Adicionar opção</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Quórum (opcional)" dica="Fecha ao atingir.">
              <input type="number" min={1} className="input" value={quorum} onChange={(e) => setQuorum(e.target.value)} />
            </Campo>
            <Campo label="Prazo (opcional)">
              <input type="datetime-local" className="input" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Campo>
          </div>
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
            <input type="checkbox" className="h-5 w-5 accent-marca-600" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Voto secreto</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
            <input type="checkbox" className="h-5 w-5 accent-marca-600" checked={justificativa} onChange={(e) => setJustificativa(e.target.checked)} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Permitir justificativa no voto</span>
          </label>
        </div>
      )}
    </Modal>
  );
}
