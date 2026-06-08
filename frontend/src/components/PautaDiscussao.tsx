import { useEffect, useRef, useState } from "react";
import { Paperclip, RefreshCw, Send, X, FileText, Pencil, Trash2 } from "lucide-react";
import { api, postForm, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { PautaComentario, PautaAnexo, Paginated } from "../lib/types";
import { Avatar, Card, SkeletonLista, Vazio } from "../ui/components";
import { Confirmacao } from "../ui/Modal";
import { renderMarkdown } from "../lib/markdown";
import { formatData, formatHora } from "../lib/format";

function ehImagem(a: PautaAnexo) {
  return /^image\//.test(a.tipo_mime) || /\.(png|jpe?g|gif|webp)$/i.test(a.nome_original);
}
function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PautaDiscussao({ pautaId }: { pautaId: number }) {
  const { me } = useAuth();
  const toast = useToast();
  const [comentarios, setComentarios] = useState<PautaComentario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [excluir, setExcluir] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = () => {
    api
      .get<Paginated<PautaComentario> | PautaComentario[]>(`/api/pauta-comentarios/?pauta=${pautaId}`)
      .then((d) => {
        setComentarios(Array.isArray(d) ? d : d.results);
        setAtualizadoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      })
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [pautaId]);

  const escolherArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novos = Array.from(e.target.files || []);
    e.target.value = "";
    const validos = novos.filter((f) => f.size <= 10 * 1024 * 1024);
    if (validos.length !== novos.length) toast.erro("Arquivo maior que 10 MB ignorado.");
    setArquivos((a) => [...a, ...validos].slice(0, 5));
  };

  const publicar = async () => {
    if (!texto.trim() && arquivos.length === 0) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("pauta", String(pautaId));
      fd.append("texto", texto);
      arquivos.forEach((f) => fd.append("anexos", f));
      await postForm("/api/pauta-comentarios/", fd);
      setTexto("");
      setArquivos([]);
      carregar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Não foi possível publicar.");
    } finally {
      setEnviando(false);
    }
  };

  const salvarEdicao = async (id: number) => {
    try {
      await api.patch(`/api/pauta-comentarios/${id}/`, { texto: textoEdit });
      setEditando(null);
      carregar();
    } catch {
      toast.erro("Erro ao editar.");
    }
  };

  const confirmarExcluir = async () => {
    if (excluir == null) return;
    try {
      await api.del(`/api/pauta-comentarios/${excluir}/`);
      setExcluir(null);
      carregar();
    } catch {
      toast.erro("Erro ao excluir.");
    }
  };

  if (carregando) return <SkeletonLista n={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{comentarios.length} comentário(s) {atualizadoEm && `• carregado às ${atualizadoEm}`}</span>
        <button onClick={carregar} className="flex items-center gap-1 font-semibold text-marca-700">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {comentarios.length === 0 ? (
        <Vazio titulo="Nenhum comentário ainda" descricao="Comece a discussão antes de votar." />
      ) : (
        <div className="space-y-3">
          {comentarios.map((c) => {
            const meu = c.autor === me?.profile.id;
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar nome={c.autor_detalhe.nome} foto={c.autor_detalhe.foto} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{c.autor_detalhe.nome}</span>
                      <span className="text-xs text-slate-400">
                        {formatData(c.criado_em)} {formatHora(c.criado_em)} {c.editado && "(editado)"}
                      </span>
                    </div>
                    {editando === c.id ? (
                      <div className="mt-1">
                        <textarea className="input min-h-[70px]" value={textoEdit} onChange={(e) => setTextoEdit(e.target.value)} />
                        <div className="mt-1 flex gap-2">
                          <button onClick={() => salvarEdicao(c.id)} className="text-sm font-semibold text-marca-700">Salvar</button>
                          <button onClick={() => setEditando(null)} className="text-sm text-slate-400">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="prosa mt-1 text-sm text-slate-700 dark:text-slate-200"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(c.texto) }}
                      />
                    )}
                    {c.anexos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.anexos.map((a) =>
                          ehImagem(a) ? (
                            <img
                              key={a.id}
                              src={a.arquivo || ""}
                              alt={a.nome_original}
                              onClick={() => setLightbox(a.arquivo)}
                              className="h-20 w-20 cursor-pointer rounded-lg object-cover"
                            />
                          ) : (
                            <a
                              key={a.id}
                              href={a.arquivo || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs hover:bg-slate-50 dark:border-slate-700"
                            >
                              <FileText size={18} className="text-marca-600" />
                              <span className="max-w-[140px] truncate">{a.nome_original}</span>
                              <span className="text-slate-400">{tamanho(a.tamanho_bytes)}</span>
                            </a>
                          ),
                        )}
                      </div>
                    )}
                    {meu && editando !== c.id && (
                      <div className="mt-1 flex gap-3">
                        <button onClick={() => { setEditando(c.id); setTextoEdit(c.texto); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-marca-600">
                          <Pencil size={13} /> Editar
                        </button>
                        <button onClick={() => setExcluir(c.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
                          <Trash2 size={13} /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor */}
      <Card className="p-3">
        <textarea
          className="input min-h-[80px]"
          placeholder="Escreva um comentário... (Markdown: **negrito**, *itálico*, listas, [link](url))"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {arquivos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {arquivos.map((f, i) => (
              <span key={i} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {f.name}
                <button onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} aria-label="Remover">
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-sm font-semibold text-slate-500">
            <Paperclip size={18} /> Anexar ({arquivos.length}/5)
          </button>
          <button onClick={publicar} disabled={enviando} className="btn-primary !px-4 !py-2 text-sm">
            <Send size={16} /> Publicar
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.txt,.md" className="hidden" onChange={escolherArquivos} />
      </Card>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}

      <Confirmacao
        aberto={excluir != null}
        aoFechar={() => setExcluir(null)}
        aoConfirmar={confirmarExcluir}
        titulo="Excluir comentário"
        mensagem="Tem certeza? O comentário será removido da discussão."
        confirmarTexto="Excluir"
        perigo
      />
    </div>
  );
}
