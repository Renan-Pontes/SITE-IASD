import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Check, X, Save } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Grupo, Igreja, Membro, Sala } from "../lib/types";
import { Botao, Card, Carregando, Avatar, Badge, Campo, Vazio } from "../ui/components";
import { rotulo } from "../lib/format";

type Aba = "membros" | "grupos" | "salas" | "dados";

export default function AdminIgreja() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lideroIgreja, carregando } = useAuth();
  const [aba, setAba] = useState<Aba>("membros");
  const [igreja, setIgreja] = useState<Igreja | null>(null);

  useEffect(() => {
    api.get<Igreja>(`/api/igrejas/${id}/`).then(setIgreja);
  }, [id]);

  if (carregando || !igreja) return <Carregando />;
  if (!lideroIgreja(igreja.id)) {
    return (
      <Vazio titulo="Acesso restrito" descricao="Apenas a liderança da igreja pode administrar." />
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-slate-500">
        <ArrowLeft size={20} /> Voltar
      </button>
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Administrar</h1>
        <p className="text-slate-500">{igreja.nome}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {([
          ["membros", "Membros"],
          ["grupos", "Grupos"],
          ["salas", "Salas"],
          ["dados", "Dados"],
        ] as [Aba, string][]).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
              aba === k ? "bg-white text-marca-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {aba === "membros" && <Membros igrejaId={igreja.id} />}
      {aba === "grupos" && <Grupos igrejaId={igreja.id} />}
      {aba === "salas" && <Salas igrejaId={igreja.id} />}
      {aba === "dados" && <Dados igreja={igreja} aoSalvar={setIgreja} />}
    </div>
  );
}

function Membros({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    setCarregando(true);
    api
      .get<Membro[]>(`/api/igrejas/${igrejaId}/membros/?status=`)
      .then(setMembros)
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [igrejaId]);

  const aprovar = async (m: Membro, tipo: "aprovar" | "rejeitar") => {
    await api.post(`/api/membros/${m.id}/${tipo}/`).catch(() => toast.erro("Erro."));
    carregar();
  };
  const papel = async (m: Membro, papel: string) => {
    try {
      await api.post(`/api/membros/${m.id}/definir_papel/`, { papel });
      toast.sucesso("Papel atualizado.");
      carregar();
    } catch {
      toast.erro("Erro ao atualizar papel.");
    }
  };

  if (carregando) return <Carregando />;
  const pendentes = membros.filter((m) => m.status === "pendente");
  const ativos = membros.filter((m) => m.status === "ativo");

  return (
    <div className="space-y-4">
      {pendentes.length > 0 && (
        <section>
          <h3 className="mb-2 font-bold text-amber-800">Pendentes ({pendentes.length})</h3>
          <div className="space-y-2">
            {pendentes.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3">
                <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={40} />
                <span className="flex-1 font-medium text-slate-700">{m.usuario_detalhe.nome}</span>
                <button onClick={() => aprovar(m, "aprovar")} className="rounded-full bg-marca-600 p-2 text-white" aria-label="Aprovar">
                  <Check size={18} />
                </button>
                <button onClick={() => aprovar(m, "rejeitar")} className="rounded-full bg-red-100 p-2 text-red-600" aria-label="Recusar">
                  <X size={18} />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 font-bold text-slate-600">Membros ativos ({ativos.length})</h3>
        <div className="space-y-2">
          {ativos.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 p-3">
              <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={40} />
              <span className="flex-1 truncate font-medium text-slate-700">{m.usuario_detalhe.nome}</span>
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                value={m.papel}
                onChange={(e) => papel(m, e.target.value)}
              >
                <option value="visitante">Visitante</option>
                <option value="membro">Membro</option>
                <option value="anciao">Ancião</option>
                <option value="pastor">Pastor</option>
                <option value="admin_igreja">Administrador</option>
              </select>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Grupos({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "ministerio", descricao: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api.get<Grupo[]>(`/api/igrejas/${igrejaId}/grupos/`).then(setGrupos);
  useEffect(() => {
    carregar();
  }, [igrejaId]);

  const criar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await api.post("/api/grupos/", { ...form, igreja: igrejaId });
      toast.sucesso("Grupo criado!");
      setForm({ nome: "", tipo: "ministerio", descricao: "" });
      carregar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao criar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h3 className="font-bold text-slate-700">Novo grupo</h3>
        <Campo label="Nome">
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Campo>
        <Campo label="Tipo">
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="ministerio">Ministério</option>
            <option value="classe">Classe / Escola Sabatina</option>
            <option value="desbravadores">Desbravadores</option>
            <option value="aventureiros">Aventureiros</option>
            <option value="musica">Música / Louvor</option>
            <option value="jovens">Jovens</option>
            <option value="outro">Outro</option>
          </select>
        </Campo>
        <Botao full onClick={criar} carregando={salvando}>
          <Plus size={18} /> Criar grupo
        </Botao>
      </Card>
      <div className="space-y-2">
        {grupos.map((g) => (
          <Card key={g.id} className="flex items-center justify-between p-3">
            <span className="font-medium text-slate-700">{g.nome}</span>
            <Badge cor="cinza">{rotulo.tipoGrupo(g.tipo)}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Salas({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [form, setForm] = useState({ nome: "", capacidade: "", equipamentos: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api.get<Sala[]>(`/api/igrejas/${igrejaId}/salas/`).then(setSalas);
  useEffect(() => {
    carregar();
  }, [igrejaId]);

  const criar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      await api.post("/api/salas/", {
        nome: form.nome,
        igreja: igrejaId,
        capacidade: form.capacidade ? Number(form.capacidade) : null,
        equipamentos: form.equipamentos,
      });
      toast.sucesso("Sala criada!");
      setForm({ nome: "", capacidade: "", equipamentos: "" });
      carregar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao criar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h3 className="font-bold text-slate-700">Nova sala / local</h3>
        <Campo label="Nome">
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Capacidade">
            <input
              type="number"
              className="input"
              value={form.capacidade}
              onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
            />
          </Campo>
          <Campo label="Equipamentos">
            <input
              className="input"
              value={form.equipamentos}
              onChange={(e) => setForm({ ...form, equipamentos: e.target.value })}
            />
          </Campo>
        </div>
        <Botao full onClick={criar} carregando={salvando}>
          <Plus size={18} /> Criar sala
        </Botao>
      </Card>
      <div className="space-y-2">
        {salas.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-3">
            <span className="font-medium text-slate-700">{s.nome}</span>
            {s.capacidade && <Badge cor="cinza">{s.capacidade} lugares</Badge>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Dados({ igreja, aoSalvar }: { igreja: Igreja; aoSalvar: (i: Igreja) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: igreja.nome,
    descricao: igreja.descricao,
    endereco: igreja.endereco,
    cidade: igreja.cidade,
    estado: igreja.estado,
    telefone: igreja.telefone,
    email: igreja.email,
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  const salvar = async () => {
    setSalvando(true);
    try {
      const atualizada = await api.patch<Igreja>(`/api/igrejas/${igreja.id}/`, form);
      aoSalvar(atualizada);
      toast.sucesso("Dados salvos!");
    } catch {
      toast.erro("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <Campo label="Nome">
        <input className="input" value={form.nome} onChange={set("nome")} />
      </Campo>
      <Campo label="Descrição">
        <textarea className="input min-h-[70px]" value={form.descricao} onChange={set("descricao")} />
      </Campo>
      <Campo label="Endereço">
        <input className="input" value={form.endereco} onChange={set("endereco")} />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Campo label="Cidade">
            <input className="input" value={form.cidade} onChange={set("cidade")} />
          </Campo>
        </div>
        <Campo label="UF">
          <input className="input" maxLength={2} value={form.estado} onChange={set("estado")} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Telefone">
          <input className="input" value={form.telefone} onChange={set("telefone")} />
        </Campo>
        <Campo label="E-mail">
          <input className="input" value={form.email} onChange={set("email")} />
        </Campo>
      </div>
      <Botao full onClick={salvar} carregando={salvando}>
        <Save size={18} /> Salvar dados
      </Botao>
    </Card>
  );
}
