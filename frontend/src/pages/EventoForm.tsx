import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ImagePlus, X } from "lucide-react";
import { api, ApiError, uploadArquivo } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Evento, Grupo, Sala } from "../lib/types";
import { Botao, Campo, Carregando } from "../ui/components";

function paraInputLocal(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Conflito = { evento_id: number; titulo: string; inicio: string; fim: string; grupo: string | null };
type Disponibilidade = {
  disponivel: boolean;
  conflitos: Conflito[];
  proximo_horario: { inicio: string; fim: string } | null;
  salas_alternativas: { id: number; nome: string }[];
};

function horaCurta(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventoForm() {
  const { id } = useParams();
  const editando = !!id;
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAuth();

  const minhasIgrejas = (me?.vinculos_igreja || []).filter((v) => v.status === "ativo");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [checandoSala, setChecandoSala] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    igreja: minhasIgrejas[0]?.igreja ? String(minhasIgrejas[0].igreja) : "",
    grupo: "",
    sala: "",
    inicio: "",
    fim: "",
    visibilidade: "publico",
    recorrencia: "nenhuma",
  });

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Foto do evento.
  const [foto, setFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.erro("Selecione um arquivo de imagem.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.erro("Imagem muito grande (máximo 5 MB).");
      return;
    }
    setFoto(f);
    setPreviewFoto(URL.createObjectURL(f));
  };

  const removerFoto = () => {
    setFoto(null);
    setPreviewFoto(null);
  };

  // Carrega evento ao editar.
  useEffect(() => {
    if (!editando) return;
    api
      .get<Evento>(`/api/eventos/${id}/`)
      .then((ev) => {
        setForm({
          titulo: ev.titulo,
          descricao: ev.descricao,
          igreja: String(ev.igreja),
          grupo: ev.grupo ? String(ev.grupo) : "",
          sala: ev.sala ? String(ev.sala) : "",
          inicio: paraInputLocal(ev.inicio),
          fim: paraInputLocal(ev.fim),
          visibilidade: ev.visibilidade,
          recorrencia: ev.recorrencia,
        });
        if (ev.foto) setPreviewFoto(ev.foto);
      })
      .finally(() => setCarregando(false));
  }, [editando, id]);

  // Carrega grupos e salas da igreja escolhida.
  useEffect(() => {
    if (!form.igreja) return;
    api.get<Grupo[]>(`/api/igrejas/${form.igreja}/grupos/`).then(setGrupos).catch(() => {});
    api.get<Sala[]>(`/api/igrejas/${form.igreja}/salas/`).then(setSalas).catch(() => {});
  }, [form.igreja]);

  // Verifica conflito de horário na sala (com debounce).
  useEffect(() => {
    if (!form.sala || !form.inicio || !form.fim) {
      setDisp(null);
      return;
    }
    const ini = new Date(form.inicio);
    const fim = new Date(form.fim);
    if (isNaN(ini.getTime()) || isNaN(fim.getTime()) || fim <= ini) {
      setDisp(null);
      return;
    }
    setChecandoSala(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ inicio: ini.toISOString(), fim: fim.toISOString() });
      if (editando && id) qs.set("excluir", id);
      api
        .get<Disponibilidade>(`/api/salas/${form.sala}/disponibilidade/?${qs.toString()}`)
        .then(setDisp)
        .catch(() => setDisp(null))
        .finally(() => setChecandoSala(false));
    }, 400);
    return () => clearTimeout(t);
  }, [form.sala, form.inicio, form.fim, editando, id]);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disp && !disp.disponivel) {
      toast.erro("A sala já está reservada nesse horário. Escolha outro horário ou outra sala.");
      return;
    }
    setSalvando(true);
    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao,
      igreja: Number(form.igreja),
      grupo: form.grupo ? Number(form.grupo) : null,
      sala: form.sala ? Number(form.sala) : null,
      inicio: new Date(form.inicio).toISOString(),
      fim: new Date(form.fim).toISOString(),
      visibilidade: form.visibilidade,
      recorrencia: form.recorrencia,
    };
    try {
      const resp = editando
        ? await api.patch<Evento>(`/api/eventos/${id}/`, payload)
        : await api.post<Evento | { status: string; pauta_id: number }>("/api/eventos/", payload);
      // Evento público de quem não é ancião vira pauta no Canal dos Anciões.
      if (!editando && (resp as any).status === "pauta_aberta") {
        toast.sucesso("Evento público enviado ao Canal dos Anciões para votação.");
        nav(`/pauta/${(resp as any).pauta_id}`, { replace: true });
        return;
      }
      const ev = resp as Evento;
      // Foto é enviada após salvar (precisa do id do evento).
      if (foto) {
        try {
          await uploadArquivo(`/api/eventos/${ev.id}/foto/`, foto);
        } catch {
          toast.erro("Evento salvo, mas não foi possível enviar a foto.");
        }
      }
      toast.sucesso(
        ev.status === "pendente"
          ? "Evento enviado para aprovação dos anciões."
          : "Evento salvo!",
      );
      nav(`/evento/${ev.id}`, { replace: true });
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Erro ao salvar o evento.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Carregando />;

  if (minhasIgrejas.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-slate-800">Novo evento</h1>
        <p className="text-slate-600">
          Você precisa ser membro de uma igreja para criar eventos. Entre em uma igreja
          primeiro.
        </p>
        <Botao onClick={() => nav("/igrejas")}>Ver igrejas</Botao>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>
      <h1 className="text-2xl font-extrabold text-slate-800">
        {editando ? "Editar evento" : "Novo evento"}
      </h1>

      <form onSubmit={submeter} className="space-y-4">
        <Campo label="Título">
          <input className="input" value={form.titulo} onChange={set("titulo")} required />
        </Campo>
        <Campo label="Descrição">
          <textarea
            className="input min-h-[90px]"
            value={form.descricao}
            onChange={set("descricao")}
          />
        </Campo>

        <div>
          <span className="label">Foto (opcional)</span>
          {previewFoto ? (
            <div className="relative">
              <img src={previewFoto} alt="Foto do evento" className="h-40 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={removerFoto}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white"
                aria-label="Remover foto"
              >
                <X size={18} />
              </button>
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-3 py-1 text-sm font-semibold text-marca-700"
              >
                Trocar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:bg-slate-50"
            >
              <ImagePlus size={28} /> Adicionar foto
            </button>
          )}
          <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          <span className="mt-1 block text-xs text-slate-400">JPG ou PNG, até 5 MB.</span>
        </div>

        <Campo label="Igreja">
          <select className="input" value={form.igreja} onChange={set("igreja")} required>
            {minhasIgrejas.map((v) => (
              <option key={v.igreja} value={v.igreja}>
                {v.igreja_nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Início">
            <input
              type="datetime-local"
              className="input"
              value={form.inicio}
              onChange={set("inicio")}
              required
            />
          </Campo>
          <Campo label="Fim">
            <input
              type="datetime-local"
              className="input"
              value={form.fim}
              onChange={set("fim")}
              required
            />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Grupo (opcional)">
            <select className="input" value={form.grupo} onChange={set("grupo")}>
              <option value="">Nenhum</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Sala (opcional)">
            <select className="input" value={form.sala} onChange={set("sala")}>
              <option value="">Nenhuma</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {form.sala && form.inicio && form.fim && (
          <div aria-live="polite">
            {checandoSala && !disp && (
              <p className="text-sm text-slate-400">Verificando disponibilidade da sala…</p>
            )}
            {disp && disp.disponivel && (
              <p className="flex items-center gap-2 rounded-xl bg-marca-50 px-4 py-3 text-sm font-semibold text-marca-700">
                <CheckCircle2 size={18} /> Sala livre nesse horário.
              </p>
            )}
            {disp && !disp.disponivel && (
              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-rose-700">
                  <AlertTriangle size={18} /> Sala ocupada nesse horário
                </p>
                <ul className="space-y-1 text-sm text-rose-700">
                  {disp.conflitos.map((c) => (
                    <li key={c.evento_id}>
                      • <strong>{c.titulo}</strong> — {horaCurta(c.inicio)} às {horaCurta(c.fim)}
                      {c.grupo ? ` (${c.grupo})` : ""}
                    </li>
                  ))}
                </ul>
                {disp.proximo_horario && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        inicio: paraInputLocal(disp.proximo_horario!.inicio),
                        fim: paraInputLocal(disp.proximo_horario!.fim),
                      }));
                    }}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-marca-700 ring-1 ring-marca-200 hover:bg-marca-50"
                  >
                    Usar próximo horário livre ({horaCurta(disp.proximo_horario.inicio)})
                  </button>
                )}
                {disp.salas_alternativas.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-rose-600">Salas livres nesse horário:</span>
                    <div className="flex flex-wrap gap-2">
                      {disp.salas_alternativas.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, sala: String(s.id) }))}
                          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-marca-700 ring-1 ring-marca-200 hover:bg-marca-50"
                        >
                          {s.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Visibilidade">
            <select className="input" value={form.visibilidade} onChange={set("visibilidade")}>
              <option value="publico">Público</option>
              <option value="privado">Privado (só o grupo)</option>
            </select>
          </Campo>
          <Campo label="Repetição">
            <select className="input" value={form.recorrencia} onChange={set("recorrencia")}>
              <option value="nenhuma">Não repete</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </Campo>
        </div>

        <p className="text-sm text-slate-400">
          Eventos criados por membros vão para aprovação dos anciões. A liderança aprova
          automaticamente.
        </p>
        <Botao type="submit" full carregando={salvando}>
          {editando ? "Salvar alterações" : "Criar evento"}
        </Botao>
      </form>
    </div>
  );
}
