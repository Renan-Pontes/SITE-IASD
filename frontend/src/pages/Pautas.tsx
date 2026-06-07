import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Vote, Lock, Clock3 } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Pauta } from "../lib/types";
import { Botao, Card, Badge, SkeletonLista, Vazio, Campo } from "../ui/components";
import { Modal } from "../ui/Modal";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";
import { formatData } from "../lib/format";

export default function Pautas() {
  const { me } = useAuth();
  const toast = useToast();
  const [criar, setCriar] = useState(false);

  const igrejasLideranca = (me?.vinculos_igreja || []).filter(
    (v) => v.eh_lideranca && v.status === "ativo",
  );

  const {
    items: pautas,
    hasMore,
    loading: carregando,
    carregarMais,
    recarregar,
  } = useInfinite<Pauta>(
    (page) => `/api/pautas/?ordering=-criado_em&page=${page}`,
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Pautas</h1>
        {igrejasLideranca.length > 0 && (
          <Botao onClick={() => setCriar(true)}>
            <Plus size={18} /> Nova
          </Botao>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Espaço dos anciões para registrar e votar as decisões da igreja.
      </p>

      {carregando && pautas.length === 0 ? (
        <SkeletonLista n={3} />
      ) : pautas.length === 0 ? (
        <Vazio
          titulo="Nenhuma pauta"
          descricao="As pautas de votação dos anciões aparecem aqui."
          icone={<Vote size={48} />}
        />
      ) : (
        <>
          <div className="space-y-3">
            {pautas.map((p) => (
              <Link key={p.id} to={`/pauta/${p.id}`}>
                <Card className="p-4 hover:shadow-md">
                  <div className="mb-1 flex items-center gap-2">
                    {p.anonima && (
                      <Badge cor="cinza">
                        <Lock size={12} /> Secreta
                      </Badge>
                    )}
                    {p.status === "encerrada" || p.expirada ? (
                      <Badge cor="cinza">Encerrada</Badge>
                    ) : (
                      <Badge cor="marca">Aberta</Badge>
                    )}
                    {p.meu_voto && <Badge cor="ouro">Você votou</Badge>}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
                  <p className="text-sm text-slate-500">
                    {p.igreja_nome} • {p.total_votos} voto{p.total_votos !== 1 ? "s" : ""}
                  </p>
                  {p.prazo_votacao && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 size={13} /> Prazo: {formatData(p.prazo_votacao)}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={carregando} />
        </>
      )}

      <CriarPauta
        aberto={criar}
        aoFechar={() => setCriar(false)}
        igrejas={igrejasLideranca}
        aoCriar={() => {
          setCriar(false);
          recarregar();
          toast.sucesso("Pauta criada!");
        }}
      />
    </div>
  );
}

function CriarPauta({
  aberto,
  aoFechar,
  igrejas,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  igrejas: { igreja: number; igreja_nome: string }[];
  aoCriar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    igreja: igrejas[0]?.igreja ? String(igrejas[0].igreja) : "",
    anonima: false,
    prazo: "",
  });
  const [salvando, setSalvando] = useState(false);

  const submeter = async () => {
    if (!form.titulo.trim() || !form.igreja) {
      toast.erro("Preencha o título e a igreja.");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/api/pautas/", {
        titulo: form.titulo,
        descricao: form.descricao,
        igreja: Number(form.igreja),
        anonima: form.anonima,
        prazo_votacao: form.prazo ? new Date(form.prazo).toISOString() : null,
      });
      aoCriar();
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Erro ao criar pauta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova pauta"
      rodape={
        <>
          <Botao variante="ghost" full onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao full onClick={submeter} carregando={salvando}>
            Criar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Título">
          <input
            className="input"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
        </Campo>
        <Campo label="Descrição">
          <textarea
            className="input min-h-[80px]"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </Campo>
        <Campo label="Igreja">
          <select
            className="input"
            value={form.igreja}
            onChange={(e) => setForm({ ...form, igreja: e.target.value })}
          >
            {igrejas.map((v) => (
              <option key={v.igreja} value={v.igreja}>
                {v.igreja_nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Prazo da votação (opcional)">
          <input
            type="datetime-local"
            className="input"
            value={form.prazo}
            onChange={(e) => setForm({ ...form, prazo: e.target.value })}
          />
        </Campo>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <input
            type="checkbox"
            className="h-5 w-5 accent-marca-600"
            checked={form.anonima}
            onChange={(e) => setForm({ ...form, anonima: e.target.checked })}
          />
          <span className="text-sm font-medium text-slate-700">
            Voto secreto (não revela quem votou)
          </span>
        </label>
      </div>
    </Modal>
  );
}
