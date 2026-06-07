import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ThumbsUp, ThumbsDown, MinusCircle, Lock, Check } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Pauta, Voto } from "../lib/types";
import { Botao, Card, Carregando, Badge, Avatar } from "../ui/components";
import { Confirmacao } from "../ui/Modal";
import { formatData } from "../lib/format";

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

  const recarregar = () => api.get<Pauta>(`/api/pautas/${id}/`).then(setPauta);
  const carregarVotos = () =>
    api.get<Voto[]>(`/api/pautas/${id}/votos/`).then(setVotos).catch(() => {});

  useEffect(() => {
    recarregar();
    carregarVotos();
  }, [id]);

  if (!pauta) return <Carregando />;

  const encerrada = pauta.status === "encerrada" || pauta.expirada;
  const sou = lideroIgreja(pauta.igreja);
  const total = pauta.resultado.sim + pauta.resultado.nao + pauta.resultado.abstencao;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const votar = async (opcao: "sim" | "nao" | "abstencao") => {
    setSalvando(true);
    try {
      await api.post(`/api/pautas/${id}/votar/`, { opcao, comentario });
      toast.sucesso("Voto registrado!");
      setComentario("");
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

  const opcoes = [
    { k: "sim" as const, Icone: ThumbsUp, cor: "marca", n: pauta.resultado.sim, label: "Sim" },
    { k: "nao" as const, Icone: ThumbsDown, cor: "vermelho", n: pauta.resultado.nao, label: "Não" },
    { k: "abstencao" as const, Icone: MinusCircle, cor: "cinza", n: pauta.resultado.abstencao, label: "Abstenção" },
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap gap-2">
          {pauta.anonima && (
            <Badge cor="cinza">
              <Lock size={12} /> Voto secreto
            </Badge>
          )}
          <Badge cor={encerrada ? "cinza" : "marca"}>{encerrada ? "Encerrada" : "Aberta"}</Badge>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">{pauta.titulo}</h1>
        <p className="text-sm text-slate-500">{pauta.igreja_nome}</p>
        {pauta.descricao && <p className="mt-3 whitespace-pre-wrap text-slate-600">{pauta.descricao}</p>}
        {pauta.prazo_votacao && (
          <p className="mt-2 text-xs text-slate-400">Prazo: {formatData(pauta.prazo_votacao)}</p>
        )}
      </Card>

      {/* Votação */}
      {!encerrada && (
        <Card className="p-4">
          <h2 className="mb-3 text-center font-bold text-slate-700">
            {pauta.meu_voto ? "Você pode alterar seu voto" : "Como você vota?"}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {opcoes.map(({ k, Icone, label }) => (
              <button
                key={k}
                onClick={() => votar(k)}
                disabled={salvando}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-4 font-bold transition ${
                  pauta.meu_voto === k
                    ? k === "sim"
                      ? "border-marca-600 bg-marca-600 text-white"
                      : k === "nao"
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-slate-400 bg-slate-400 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icone size={28} /> {label}
              </button>
            ))}
          </div>
          <input
            className="input mt-3"
            placeholder="Comentário (opcional)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
        </Card>
      )}

      {/* Resultado */}
      <Card className="p-5">
        <h2 className="mb-3 font-bold text-slate-800">Resultado ({total} votos)</h2>
        <div className="space-y-3">
          {opcoes.map(({ k, label, n }) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm font-medium text-slate-600">
                <span>{label}</span>
                <span>
                  {n} ({pct(n)}%)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    k === "sim" ? "bg-marca-600" : k === "nao" ? "bg-red-500" : "bg-slate-400"
                  }`}
                  style={{ width: `${pct(n)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Lista de votos (oculta autores se anônima) */}
      {votos.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-700">Votos</h2>
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
                <div className="flex-1">
                  <span className="font-medium text-slate-700">
                    {v.usuario_detalhe ? v.usuario_detalhe.nome : "Voto secreto"}
                  </span>
                  {v.comentario && <p className="text-sm text-slate-500">{v.comentario}</p>}
                </div>
                <Badge cor={v.opcao === "sim" ? "marca" : v.opcao === "nao" ? "vermelho" : "cinza"}>
                  {v.opcao === "sim" ? "Sim" : v.opcao === "nao" ? "Não" : "Abstenção"}
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

      <Confirmacao
        aberto={confirmarEncerrar}
        aoFechar={() => setConfirmarEncerrar(false)}
        aoConfirmar={encerrar}
        titulo="Encerrar votação"
        mensagem="Após encerrar, ninguém mais poderá votar. Continuar?"
        confirmarTexto="Encerrar"
      />
    </div>
  );
}
