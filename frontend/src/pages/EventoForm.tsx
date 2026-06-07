import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Evento, Grupo, Sala } from "../lib/types";
import { Botao, Campo, Carregando } from "../ui/components";

function paraInputLocal(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
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

  // Carrega evento ao editar.
  useEffect(() => {
    if (!editando) return;
    api
      .get<Evento>(`/api/eventos/${id}/`)
      .then((ev) =>
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
        }),
      )
      .finally(() => setCarregando(false));
  }, [editando, id]);

  // Carrega grupos e salas da igreja escolhida.
  useEffect(() => {
    if (!form.igreja) return;
    api.get<Grupo[]>(`/api/igrejas/${form.igreja}/grupos/`).then(setGrupos).catch(() => {});
    api.get<Sala[]>(`/api/igrejas/${form.igreja}/salas/`).then(setSalas).catch(() => {});
  }, [form.igreja]);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const ev = editando
        ? await api.patch<Evento>(`/api/eventos/${id}/`, payload)
        : await api.post<Evento>("/api/eventos/", payload);
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
