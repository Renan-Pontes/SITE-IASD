import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Check, Eye, Save, X } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Ata, Igreja } from "../lib/types";
import { Botao, Card, Carregando, Badge, Vazio } from "../ui/components";
import { renderMarkdown } from "../lib/markdown";
import { formatData } from "../lib/format";

export default function Atas() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lideroIgreja, souSecretaria, carregando: authLoad } = useAuth();
  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [atas, setAtas] = useState<Ata[]>([]);
  const [carregando, setCarregando] = useState(true);

  const igrejaId = Number(id);
  const podeEditar = souSecretaria(igrejaId);
  const podeVer = podeEditar || lideroIgreja(igrejaId);

  const carregar = () => {
    setCarregando(true);
    api
      .get<{ results: Ata[] } | Ata[]>(`/api/atas/?igreja=${id}&ordering=-criado_em`)
      .then((d) => setAtas(Array.isArray(d) ? d : d.results))
      .finally(() => setCarregando(false));
  };
  useEffect(() => {
    api.get<Igreja>(`/api/igrejas/${id}/`).then(setIgreja).catch(() => {});
    carregar();
  }, [id]);

  if (authLoad || !igreja) return <Carregando />;
  if (!podeVer) return <Navigate to={`/igreja/${id}`} replace />;

  const rascunhos = atas.filter((a) => a.status === "rascunho");
  const publicadas = atas.filter((a) => a.status === "publicada");

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          <FileText className="text-marca-600" /> Atas
        </h1>
        <p className="text-slate-500">{igreja.nome}</p>
      </div>

      <p className="rounded-xl bg-marca-50 p-3 text-sm text-marca-800 dark:bg-marca-900/20 dark:text-marca-200">
        Cada pauta encerrada gera um <b>rascunho de ata</b> automaticamente.
        {podeEditar
          ? " Revise, complemente e publique."
          : " A secretaria revisa e publica."}
      </p>

      {carregando ? (
        <Carregando />
      ) : atas.length === 0 ? (
        <Vazio titulo="Nenhuma ata ainda" descricao="As atas aparecem quando uma pauta é encerrada." icone={<FileText size={48} />} />
      ) : (
        <>
          {rascunhos.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold text-amber-800 dark:text-amber-300">
                Rascunhos ({rascunhos.length})
              </h2>
              <div className="space-y-3">
                {rascunhos.map((a) => (
                  <AtaCard key={a.id} ata={a} podeEditar={podeEditar} aoMudar={carregar} />
                ))}
              </div>
            </section>
          )}
          {publicadas.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold text-slate-700 dark:text-slate-200">
                Publicadas ({publicadas.length})
              </h2>
              <div className="space-y-3">
                {publicadas.map((a) => (
                  <AtaCard key={a.id} ata={a} podeEditar={podeEditar} aoMudar={carregar} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AtaCard({ ata, podeEditar, aoMudar }: { ata: Ata; podeEditar: boolean; aoMudar: () => void }) {
  const toast = useToast();
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(ata.conteudo);
  const [salvando, setSalvando] = useState(false);
  const publicada = ata.status === "publicada";

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/api/atas/${ata.id}/`, { conteudo: texto });
      toast.sucesso("Ata salva.");
      setEditando(false);
      aoMudar();
    } catch {
      toast.erro("Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const publicar = async () => {
    try {
      await api.post(`/api/atas/${ata.id}/publicar/`);
      toast.sucesso("Ata publicada.");
      aoMudar();
    } catch {
      toast.erro("Não foi possível publicar.");
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge cor={publicada ? "marca" : "ouro"}>
              {publicada ? <><Check size={12} /> Publicada</> : "Rascunho"}
            </Badge>
            {ata.pauta_titulo && <Badge cor="azul">Pauta</Badge>}
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{ata.titulo}</h3>
          <p className="text-xs text-slate-400">
            {publicada && ata.publicada_em ? `Publicada em ${formatData(ata.publicada_em)}` : `Criada em ${formatData(ata.criado_em)}`}
          </p>
        </div>
        <button
          onClick={() => setAberta((v) => !v)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:bg-slate-800"
        >
          <Eye size={16} className="inline" /> {aberta ? "Fechar" : "Abrir"}
        </button>
      </div>

      {aberta && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          {editando ? (
            <>
              <textarea
                className="input min-h-[260px] font-mono text-sm"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Botao onClick={salvar} carregando={salvando}>
                  <Save size={16} /> Salvar
                </Botao>
                <Botao variante="ghost" onClick={() => { setTexto(ata.conteudo); setEditando(false); }}>
                  <X size={16} /> Cancelar
                </Botao>
              </div>
            </>
          ) : (
            <>
              <div
                className="prosa text-sm text-slate-700 dark:text-slate-200"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(ata.conteudo) }}
              />
              {podeEditar && (
                <div className="mt-3 flex gap-2">
                  <Botao variante="secondary" onClick={() => { setTexto(ata.conteudo); setEditando(true); }}>
                    <Pencil size={16} /> Editar
                  </Botao>
                  {!publicada && (
                    <Botao onClick={publicar}>
                      <Check size={16} /> Publicar
                    </Botao>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
