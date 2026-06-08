import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, MinusCircle, Lock, Check, CheckCircle2,
  XCircle, CircleDot, Gavel,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Pauta, Voto } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar } from "../ui/components";
import { Confirmacao } from "../ui/Modal";
import { PautaDiscussao } from "../components/PautaDiscussao";
import { formatData, formatHora, rotulo } from "../lib/format";

export default function PautaDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { lideroIgreja } = useAuth();
  const [pauta, setPauta] = useState<Pauta | null>(null);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [aba, setAba] = useState<"votacao" | "discussao">("votacao");

  const recarregar = () => api.get<Pauta>(`/api/pautas/${id}/`).then(setPauta);
  const carregarVotos = () =>
    api.get<Voto[]>(`/api/pautas/${id}/votos/`).then(setVotos).catch(() => {});

  useEffect(() => {
    recarregar();
    carregarVotos();
  }, [id]);

  if (!pauta) return <Carregando />;

  const encerrada = pauta.status !== "aberta" || pauta.expirada;
  const semQuorum = pauta.status === "expirada_sem_quorum";
  const sou = lideroIgreja(pauta.igreja);
  const ehEnquete = pauta.tipo === "enquete_livre" && !!pauta.opcoes?.length;

  // Opções de voto: enquete usa as customizadas; senão sim/não/abstenção.
  const opcoes: { k: string; label: string; Icone: any; cor: string }[] = ehEnquete
    ? pauta.opcoes!.map((o) => ({ k: o, label: o, Icone: CircleDot, cor: "marca" }))
    : [
        { k: "sim", label: "Sim", Icone: ThumbsUp, cor: "marca" },
        { k: "nao", label: "Não", Icone: ThumbsDown, cor: "vermelho" },
        { k: "abstencao", label: "Abstenção", Icone: MinusCircle, cor: "cinza" },
      ];

  const total = pauta.resultado ? Object.values(pauta.resultado).reduce((s, n) => s + n, 0) : 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const metodos: Record<string, string> = {
    unanimidade: "Unanimidade", maioria_simples: "Maioria simples",
    maioria_absoluta: "Maioria absoluta", dois_tercos: "Dois terços",
    quorum_aprovacao: "Quórum de aprovação", lider: "Aprovação simples",
  };
  const corBarra = (k: string) =>
    k === "sim" ? "bg-marca-600" : k === "nao" ? "bg-red-500" : k === "abstencao" ? "bg-slate-400" : "bg-marca-500";

  const votar = async (opcao: string) => {
    setSalvando(true);
    try {
      await api.post(`/api/pautas/${id}/votar/`, { opcao, comentario });
      toast.sucesso("Voto registrado!");
      setComentario("");
      setAlterando(false);
      await recarregar();
      await carregarVotos();
    } catch {
      toast.erro("Não foi possível votar.");
    } finally {
      setSalvando(false);
    }
  };

  const encerrar = async () => {
    try {
      await api.post(`/api/pautas/${id}/encerrar/`);
      toast.info("Votação encerrada.");
      setConfirmarEncerrar(false);
      recarregar();
    } catch {
      toast.erro("Erro ao encerrar.");
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge cor="azul">
            <Gavel size={12} /> {rotulo.tipoPauta(pauta.tipo)}
          </Badge>
          {pauta.anonima && (
            <Badge cor="cinza">
              <Lock size={12} /> Voto secreto
            </Badge>
          )}
          <Badge cor={encerrada ? "cinza" : "marca"}>{encerrada ? "Encerrada" : "Aberta"}</Badge>
          <Badge cor="azul">{metodos[pauta.metodo_votacao] || pauta.metodo_votacao}</Badge>
          {pauta.aplicada_em && <Badge cor="ouro">✓ Aplicada</Badge>}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{pauta.titulo}</h1>
        <p className="text-sm text-slate-500">{pauta.igreja_nome}</p>
        {semQuorum && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            ⏳ Expirou sem atingir o quórum. {pauta.criada_por_detalhe ? "O proponente pode reenviar." : ""}
          </p>
        )}
        {pauta.descricao && <p className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{pauta.descricao}</p>}
        {pauta.prazo_votacao && <p className="mt-2 text-xs text-slate-400">Prazo: {formatData(pauta.prazo_votacao)}</p>}
        {pauta.quorum_minimo && (
          <p className="mt-1 text-xs text-slate-400">
            Quórum: {pauta.total_votos}/{pauta.quorum_minimo} votos{pauta.quorum_atingido ? " ✓" : ""}
          </p>
        )}
      </Card>

      {/* Abas: Discussão (fórum) | Votação */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {([["votacao", "Votação"], ["discussao", "Discussão"]] as ["votacao" | "discussao", string][]).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              aba === k ? "bg-white text-marca-700 shadow-sm dark:bg-slate-700 dark:text-marca-300" : "text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {aba === "discussao" && <PautaDiscussao pautaId={pauta.id} />}

      {aba === "votacao" && (
      <>
      {/* Proposta (diff) para alteração de igreja */}
      {pauta.tipo === "alteracao_igreja" && pauta.payload?.depois && (
        <Card className="p-4">
          <h2 className="mb-2 font-bold text-slate-700 dark:text-slate-200">Proposta de alteração</h2>
          <div className="space-y-1 text-sm">
            {Object.keys(pauta.payload.depois).map((k) => (
              <div key={k} className="flex flex-wrap gap-1">
                <span className="font-semibold capitalize text-slate-500">{k}:</span>
                <span className="text-red-500 line-through">{String(pauta.payload.antes?.[k] ?? "—")}</span>
                <span>→</span>
                <span className="font-semibold text-marca-700 dark:text-marca-300">{String(pauta.payload.depois[k])}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Timeline pauta={pauta} />

      {/* Votação — voto começa SEM resposta (neutro); nada pré-selecionado. */}
      {!encerrada && sou && (
        <Card className="p-4">
          {pauta.meu_voto && !alterando ? (
            <div className="text-center">
              <p className="text-sm text-slate-500">Seu voto registrado:</p>
              <p className="my-2 text-xl font-extrabold text-marca-700 dark:text-marca-300">
                {pauta.meu_voto === "sim" ? "Sim" : pauta.meu_voto === "nao" ? "Não" : pauta.meu_voto === "abstencao" ? "Abstenção" : pauta.meu_voto}
              </p>
              <Botao variante="secondary" onClick={() => setAlterando(true)}>
                Alterar meu voto
              </Botao>
            </div>
          ) : (
            <>
              {!pauta.meu_voto && (
                <div className="mb-3 rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  ⚠️ Você ainda não votou nesta pauta.
                </div>
              )}
              <h2 className="mb-3 text-center font-bold text-slate-700 dark:text-slate-200">
                {ehEnquete ? "Escolha uma opção" : "Como você vota?"}
              </h2>
              <div className={`grid gap-2 ${opcoes.length > 3 ? "grid-cols-2" : "grid-cols-3"}`}>
                {opcoes.map(({ k, label, Icone }) => (
                  <button
                    key={k}
                    onClick={() => votar(k)}
                    disabled={salvando}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 py-4 font-bold transition ${
                      pauta.meu_voto === k
                        ? k === "nao"
                          ? "border-red-500 bg-red-500 text-white"
                          : k === "abstencao"
                            ? "border-slate-400 bg-slate-400 text-white"
                            : "border-marca-600 bg-marca-600 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                    }`}
                  >
                    <Icone size={26} /> <span className="text-center text-sm">{label}</span>
                  </button>
                ))}
              </div>
              {pauta.permitir_justificativa && (
                <input
                  className="input mt-3"
                  placeholder="Justificar minha decisão (opcional)"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              )}
            </>
          )}
        </Card>
      )}

      {/* Anonimato: durante a votação não mostra contagem, só participação. */}
      {!pauta.mostra_resultado && (
        <Card className="p-5">
          <div className="mb-3 rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            🔒 Votação anônima. Os votos serão revelados após o encerramento.
          </div>
          <p className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
            {pauta.total_votos} de {pauta.total_eleitores} anciões já votaram
          </p>
          {pauta.pendentes.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-500">Ainda não votaram:</p>
              <div className="flex flex-wrap gap-2">
                {pauta.pendentes.map((p) => (
                  <span key={p.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {p.nome}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Resultado (visível quando não anônima ou após encerrar) */}
      {pauta.mostra_resultado && pauta.resultado && (
      <Card className="p-5">
        <h2 className="mb-3 font-bold text-slate-800 dark:text-slate-100">Resultado ({total} votos)</h2>
        <div className="space-y-3">
          {Object.entries(pauta.resultado).map(([k, n]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="capitalize">{k === "nao" ? "Não" : k}</span>
                <span>{n} ({pct(n)}%)</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${corBarra(k)}`} style={{ width: `${pct(n)}%` }} />
              </div>
            </div>
          ))}
        </div>
        {encerrada && pauta.decisao && (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-center text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Decisão: {pauta.decisao === "aprovado" ? "✅ Aprovada" : pauta.decisao === "rejeitado" ? "❌ Rejeitada" : pauta.decisao === "empate" ? "Empate" : `“${pauta.decisao}”`}
          </p>
        )}
      </Card>
      )}

      {/* Votos (oculta autores se anônima) */}
      {votos.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-700 dark:text-slate-200">Votos</h2>
          <div className="space-y-2">
            {votos.map((v) => (
              <Card key={v.id} className="flex items-center gap-3 p-3">
                {v.usuario_detalhe ? (
                  <Avatar nome={v.usuario_detalhe.nome} foto={v.usuario_detalhe.foto} size={36} />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                    <Lock size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {v.usuario_detalhe ? v.usuario_detalhe.nome : "Voto secreto"}
                  </span>
                  {v.comentario && <p className="text-sm text-slate-500">{v.comentario}</p>}
                </div>
                <Badge cor={v.opcao === "sim" ? "marca" : v.opcao === "nao" ? "vermelho" : "cinza"}>
                  {v.opcao === "sim" ? "Sim" : v.opcao === "nao" ? "Não" : v.opcao === "abstencao" ? "Abstenção" : v.opcao}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      {sou && !encerrada && (
        <Botao variante="secondary" full onClick={() => setConfirmarEncerrar(true)}>
          <Check size={18} /> Encerrar votação
        </Botao>
      )}
      </>
      )}

      <Confirmacao
        aberto={confirmarEncerrar}
        aoFechar={() => setConfirmarEncerrar(false)}
        aoConfirmar={encerrar}
        titulo="Encerrar votação"
        mensagem="Após encerrar, a decisão é apurada e (se aprovada) aplicada automaticamente. Continuar?"
        confirmarTexto="Encerrar"
      />
    </div>
  );
}

function Timeline({ pauta }: { pauta: Pauta }) {
  const encerrada = pauta.status === "encerrada";
  const etapas = [
    { label: "Criada", data: pauta.criado_em, feito: true, Icone: CircleDot },
    { label: encerrada ? "Votação encerrada" : "Em votação", data: null, feito: true, Icone: Gavel },
    {
      label: encerrada
        ? pauta.decisao === "aprovado" ? "Aprovada" : pauta.decisao === "rejeitado" ? "Rejeitada" : "Encerrada"
        : "Resultado",
      data: null,
      feito: encerrada,
      Icone: pauta.decisao === "rejeitado" ? XCircle : CheckCircle2,
    },
  ];
  if (pauta.aplicada_em) {
    etapas.push({ label: "Aplicada", data: pauta.aplicada_em, feito: true, Icone: CheckCircle2 });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        {etapas.map((e, i) => (
          <div key={i} className="flex flex-1 flex-col items-center text-center">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${e.feito ? "bg-marca-600 text-white" : "bg-slate-200 text-slate-400 dark:bg-slate-700"}`}>
              <e.Icone size={18} />
            </div>
            <span className={`mt-1 text-xs font-medium ${e.feito ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
              {e.label}
            </span>
            {e.data && <span className="text-[10px] text-slate-400">{formatData(e.data)} {formatHora(e.data)}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
