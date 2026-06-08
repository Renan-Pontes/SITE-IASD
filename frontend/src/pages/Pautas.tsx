import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Vote, Lock, Clock3, Gavel, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import type { Pauta } from "../lib/types";
import { Card, Badge, SkeletonLista, Vazio } from "../ui/components";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { formatData, rotulo } from "../lib/format";

type Aba = "aguardando" | "andamento" | "historico";

const CATEGORIAS = [
  ["", "Todas"], ["infraestrutura", "Infraestrutura"], ["programacao", "Programação"],
  ["financeiro", "Financeiro"], ["grupos", "Grupos"], ["pessoal", "Pessoal"], ["outros", "Outros"],
] as const;

export default function Pautas() {
  const { me } = useAuth();
  const [aba, setAba] = useState<Aba>("aguardando");
  const [cat, setCat] = useState("");

  const igrejasLideranca = (me?.vinculos_igreja || []).filter(
    (v) => v.eh_lideranca && v.status === "ativo",
  );
  const canalIgreja = igrejasLideranca[0]?.igreja;

  const { items: pautas, hasMore, loading, carregarMais } = useInfinite<Pauta>(
    (page) => `/api/pautas/?ordering=-criado_em&page=${page}`,
    [],
  );

  const filtradas = useMemo(() => {
    const porCat = cat ? pautas.filter((p) => p.categoria === cat) : pautas;
    if (aba === "aguardando") return porCat.filter((p) => p.status === "aberta" && !p.meu_voto);
    if (aba === "andamento") return porCat.filter((p) => p.status === "aberta" && p.meu_voto);
    return porCat.filter((p) => p.status !== "aberta");
  }, [pautas, aba, cat]);

  const nAguardando = pautas.filter((p) => p.status === "aberta" && !p.meu_voto).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          <Gavel className="text-marca-600" /> Pautas
        </h1>
        {canalIgreja && (
          <Link to={`/igreja/${canalIgreja}/canal`} className="btn-primary !px-4 !py-2 text-sm">
            <Plus size={18} /> Nova
          </Link>
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {([
          ["aguardando", `Aguardando${nAguardando ? ` (${nAguardando})` : ""}`],
          ["andamento", "Em andamento"],
          ["historico", "Histórico"],
        ] as [Aba, string][]).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
              aba === k
                ? "bg-white text-marca-700 shadow-sm dark:bg-slate-700 dark:text-marca-300"
                : "text-slate-500"
            } ${k === "aguardando" && nAguardando ? "!text-red-600" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIAS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setCat(v)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
              cat === v ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && pautas.length === 0 ? (
        <SkeletonLista n={3} />
      ) : filtradas.length === 0 ? (
        <Vazio
          titulo={aba === "aguardando" ? "Nada aguardando seu voto" : aba === "andamento" ? "Nenhuma pauta em andamento" : "Sem histórico"}
          descricao={canalIgreja ? "Crie uma pauta no Canal dos Anciões." : "As pautas das suas igrejas aparecem aqui."}
          icone={<Vote size={48} />}
        />
      ) : (
        <>
          <div className="space-y-3">
            {filtradas.map((p) => (
              <PautaCard key={p.id} p={p} />
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={loading} />
        </>
      )}
    </div>
  );
}

function PautaCard({ p }: { p: Pauta }) {
  const aberta = p.status === "aberta";
  const pct = p.total_eleitores ? Math.round((p.total_votos / p.total_eleitores) * 100) : 0;
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
          {!aberta && (
            <Badge cor={p.decisao === "aprovado" ? "marca" : p.decisao === "rejeitado" ? "vermelho" : "cinza"}>
              {p.decisao === "aprovado" ? <><CheckCircle2 size={12} /> Aprovada</> : p.decisao === "rejeitado" ? <><XCircle size={12} /> Rejeitada</> : "Encerrada"}
            </Badge>
          )}
          {p.aplicada_em && <Badge cor="ouro">✓ Aplicada</Badge>}
          {aberta && !p.meu_voto && <Badge cor="vermelho">Vote</Badge>}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
        <p className="text-sm text-slate-500">{p.igreja_nome}</p>
        {aberta && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full rounded-full bg-marca-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400">{p.total_votos}/{p.total_eleitores} votaram</span>
          </div>
        )}
        {p.prazo_votacao && aberta && (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Clock3 size={13} /> Prazo: {formatData(p.prazo_votacao)}
          </p>
        )}
      </Card>
    </Link>
  );
}
