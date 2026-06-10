import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Check, X, Save, Camera, Pencil, Archive, Gavel } from "lucide-react";
import { UploadFoto } from "../components/UploadFoto";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";
import { RejeitarModal } from "../components/RejeitarModal";
import type { Grupo, Igreja, Membro, Sala } from "../lib/types";
import { Botao, Card, Carregando, Avatar, Badge, Campo, Vazio } from "../ui/components";
import { rotulo } from "../lib/format";

type Aba = "membros" | "grupos" | "salas" | "dados";

export default function AdminIgreja() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lideroIgreja, carregando, me, ehSuper } = useAuth();
  const [aba, setAba] = useState<Aba>("membros");
  const [igreja, setIgreja] = useState<Igreja | null>(null);

  useEffect(() => {
    api.get<Igreja>(`/api/igrejas/${id}/`).then(setIgreja);
  }, [id]);

  if (carregando || !igreja) return <Carregando />;

  const ehAdmin =
    ehSuper ||
    !!me?.vinculos_igreja.some(
      (v) => v.igreja === igreja.id && v.papel === "admin_igreja" && v.status === "ativo",
    );

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
      {aba === "dados" && <Dados igreja={igreja} aoSalvar={setIgreja} ehAdmin={ehAdmin} />}
    </div>
  );
}

function Membros({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rejeitarId, setRejeitarId] = useState<number | null>(null);

  const carregar = () => {
    setCarregando(true);
    api
      .get<Membro[]>(`/api/igrejas/${igrejaId}/membros/?status=`)
      .then(setMembros)
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, [igrejaId]);

  const aprovarMembro = async (m: Membro) => {
    await api.post(`/api/membros/${m.id}/aprovar/`).catch(() => toast.erro("Erro."));
    carregar();
  };
  const confirmarRejeicao = async (motivo: string) => {
    if (rejeitarId == null) return;
    const id = rejeitarId;
    setRejeitarId(null);
    await api.post(`/api/membros/${id}/rejeitar/`, { motivo }).catch(() => toast.erro("Erro."));
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
  const toggleSecretaria = async (m: Membro) => {
    try {
      await api.post(`/api/membros/${m.id}/definir_secretaria/`, { secretaria: !m.secretaria });
      toast.sucesso(m.secretaria ? "Cargo de secretaria removido." : "Cargo de secretaria atribuído.");
      carregar();
    } catch {
      toast.erro("Erro ao atualizar secretaria.");
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
                <button onClick={() => aprovarMembro(m)} className="rounded-full bg-marca-600 p-2 text-white" aria-label="Aprovar">
                  <Check size={18} />
                </button>
                <button onClick={() => setRejeitarId(m.id)} className="rounded-full bg-red-100 p-2 text-red-600" aria-label="Recusar">
                  <X size={18} />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <RejeitarModal
        aberto={rejeitarId != null}
        aoFechar={() => setRejeitarId(null)}
        aoConfirmar={confirmarRejeicao}
      />

      <section>
        <h3 className="mb-2 font-bold text-slate-600">Membros ativos ({ativos.length})</h3>

        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {ativos.map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center gap-2 p-3">
              <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={40} />
              <span className="flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                {m.usuario_detalhe.nome}
              </span>
              <SelectPapel m={m} aoMudar={papel} />
              <SecretariaToggle m={m} aoMudar={toggleSecretaria} />
            </Card>
          ))}
        </div>

        {/* Desktop: tabela densa */}
        <div className="hidden overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 lg:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3 font-semibold">Membro</th>
                <th className="p-3 font-semibold">Papel</th>
                <th className="p-3 font-semibold">Secretaria</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Avatar nome={m.usuario_detalhe.nome} foto={m.usuario_detalhe.foto} size={32} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {m.usuario_detalhe.nome}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <SelectPapel m={m} aoMudar={papel} />
                  </td>
                  <td className="p-3">
                    <SecretariaToggle m={m} aoMudar={toggleSecretaria} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SelectPapel({ m, aoMudar }: { m: Membro; aoMudar: (m: Membro, papel: string) => void }) {
  return (
    <select
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
      value={m.papel}
      onChange={(e) => aoMudar(m, e.target.value)}
    >
      <option value="visitante">Visitante</option>
      <option value="membro">Membro</option>
      <option value="lider_igreja">Líder de igreja</option>
      <option value="anciao">Ancião</option>
      <option value="pastor">Pastor</option>
      <option value="admin_igreja">Administrador</option>
    </select>
  );
}

function SecretariaToggle({ m, aoMudar }: { m: Membro; aoMudar: (m: Membro) => void }) {
  return (
    <button
      onClick={() => aoMudar(m)}
      className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
        m.secretaria
          ? "bg-marca-600 text-white"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
      }`}
      title="Liga/desliga o cargo de secretaria"
    >
      {m.secretaria ? "Secretaria ✓" : "Secretaria"}
    </button>
  );
}

function Grupos({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "ministerio", descricao: "" });
  const [salvando, setSalvando] = useState(false);
  const [editar, setEditar] = useState<Grupo | null>(null);

  const carregar = () => api.get<Grupo[]>(`/api/igrejas/${igrejaId}/grupos/`).then(setGrupos);
  useEffect(() => {
    carregar();
  }, [igrejaId]);

  const criar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const r = await api.post("/api/grupos/", { ...form, igreja: igrejaId });
      if (r?.status === "pauta_aberta") {
        toast.sucesso("Proposta enviada ao Canal dos Anciões para votação.");
      } else {
        toast.sucesso("Grupo criado!");
        carregar();
      }
      setForm({ nome: "", tipo: "ministerio", descricao: "" });
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
            <span className="font-medium text-slate-700 dark:text-slate-200">{g.nome}</span>
            <div className="flex items-center gap-2">
              <Badge cor="cinza">{rotulo.tipoGrupo(g.tipo)}</Badge>
              <button onClick={() => setEditar(g)} aria-label="Editar grupo" className="text-slate-400 hover:text-marca-600">
                <Pencil size={18} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <EditarGrupo
        grupo={editar}
        aoFechar={() => setEditar(null)}
        aoSalvar={() => {
          setEditar(null);
          carregar();
        }}
      />
    </div>
  );
}

function EditarGrupo({
  grupo, aoFechar, aoSalvar,
}: {
  grupo: Grupo | null; aoFechar: () => void; aoSalvar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", tipo: "ministerio", descricao: "", cor: "#64748b" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (grupo) setForm({ nome: grupo.nome, tipo: grupo.tipo, descricao: grupo.descricao, cor: grupo.cor || "#64748b" });
  }, [grupo]);

  if (!grupo) return null;

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/api/grupos/${grupo.id}/`, form);
      toast.sucesso("Grupo atualizado!");
      aoSalvar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const arquivar = async () => {
    try {
      await api.patch(`/api/grupos/${grupo.id}/`, { ativo: false });
      toast.sucesso("Grupo arquivado.");
      aoSalvar();
    } catch {
      toast.erro("Erro ao arquivar.");
    }
  };

  return (
    <Modal
      aberto={!!grupo}
      aoFechar={aoFechar}
      titulo="Editar grupo"
      rodape={
        <>
          <Botao variante="ghost" onClick={arquivar}>
            <Archive size={18} /> Arquivar
          </Botao>
          <Botao full onClick={salvar} carregando={salvando}>
            <Save size={18} /> Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
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
        <Campo label="Descrição">
          <textarea className="input min-h-[70px]" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </Campo>
        <Campo label="Cor do grupo" dica="Vira o anel da bolinha do evento.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200"
              value={form.cor}
              onChange={(e) => setForm({ ...form, cor: e.target.value })}
            />
            <span className="text-sm text-slate-500">{form.cor}</span>
          </div>
        </Campo>
      </div>
    </Modal>
  );
}

function Salas({ igrejaId }: { igrejaId: number }) {
  const toast = useToast();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [form, setForm] = useState({ nome: "", capacidade: "", equipamentos: "" });
  const [salvando, setSalvando] = useState(false);
  const [editar, setEditar] = useState<Sala | null>(null);

  const carregar = () => api.get<Sala[]>(`/api/igrejas/${igrejaId}/salas/`).then(setSalas);
  useEffect(() => {
    carregar();
  }, [igrejaId]);

  const criar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const r = await api.post("/api/salas/", {
        nome: form.nome,
        igreja: igrejaId,
        capacidade: form.capacidade ? Number(form.capacidade) : null,
        equipamentos: form.equipamentos,
      });
      if (r?.status === "pauta_aberta") {
        toast.sucesso("Proposta enviada ao Canal dos Anciões para votação.");
      } else {
        toast.sucesso("Sala criada!");
        carregar();
      }
      setForm({ nome: "", capacidade: "", equipamentos: "" });
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
            <span className="font-medium text-slate-700 dark:text-slate-200">{s.nome}</span>
            <div className="flex items-center gap-2">
              {s.capacidade && <Badge cor="cinza">{s.capacidade} lugares</Badge>}
              <button onClick={() => setEditar(s)} aria-label="Editar sala" className="text-slate-400 hover:text-marca-600">
                <Pencil size={18} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <EditarSala
        sala={editar}
        aoFechar={() => setEditar(null)}
        aoSalvar={() => {
          setEditar(null);
          carregar();
        }}
      />
    </div>
  );
}

function EditarSala({
  sala, aoFechar, aoSalvar,
}: {
  sala: Sala | null; aoFechar: () => void; aoSalvar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", capacidade: "", equipamentos: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (sala)
      setForm({
        nome: sala.nome,
        capacidade: sala.capacidade ? String(sala.capacidade) : "",
        equipamentos: sala.equipamentos,
      });
  }, [sala]);

  if (!sala) return null;

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/api/salas/${sala.id}/`, {
        nome: form.nome,
        capacidade: form.capacidade ? Number(form.capacidade) : null,
        equipamentos: form.equipamentos,
      });
      toast.sucesso("Sala atualizada!");
      aoSalvar();
    } catch (e) {
      toast.erro(e instanceof ApiError ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const arquivar = async () => {
    try {
      await api.patch(`/api/salas/${sala.id}/`, { ativo: false });
      toast.sucesso("Sala arquivada.");
      aoSalvar();
    } catch {
      toast.erro("Erro ao arquivar.");
    }
  };

  return (
    <Modal
      aberto={!!sala}
      aoFechar={aoFechar}
      titulo="Editar sala"
      rodape={
        <>
          <Botao variante="ghost" onClick={arquivar}>
            <Archive size={18} /> Arquivar
          </Botao>
          <Botao full onClick={salvar} carregando={salvando}>
            <Save size={18} /> Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Nome">
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Capacidade">
            <input type="number" className="input" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} />
          </Campo>
          <Campo label="Equipamentos">
            <input className="input" value={form.equipamentos} onChange={(e) => setForm({ ...form, equipamentos: e.target.value })} />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}

function Dados({
  igreja, aoSalvar, ehAdmin,
}: {
  igreja: Igreja; aoSalvar: (i: Igreja) => void; ehAdmin: boolean;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: igreja.nome,
    descricao: igreja.descricao,
    endereco: igreja.endereco,
    cidade: igreja.cidade,
    estado: igreja.estado,
    telefone: igreja.telefone,
    email: igreja.email,
    cor_primaria: igreja.cor_primaria || "#16a34a",
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  // Anciões/pastores (não-admin) não editam direto — propõem pelo Canal.
  if (!ehAdmin) {
    return (
      <Card className="space-y-3 p-5 text-center">
        <Gavel className="mx-auto text-marca-600" size={32} />
        <h3 className="font-bold text-slate-800 dark:text-slate-100">
          Alterações passam pelo Canal dos Anciões
        </h3>
        <p className="text-sm text-slate-500">
          Para mudar os dados desta igreja, crie uma proposta no Canal dos Anciões.
          Ela será votada e aplicada automaticamente se aprovada.
        </p>
        <Link to={`/igreja/${igreja.id}/canal`}>
          <Botao>
            <Gavel size={18} /> Ir para o Canal dos Anciões
          </Botao>
        </Link>
      </Card>
    );
  }

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
      <div className="flex items-center gap-3">
        {igreja.foto ? (
          <img src={igreja.foto} alt={igreja.nome} className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-marca-100 text-2xl">⛪</div>
        )}
        <UploadFoto endpoint={`/api/igrejas/${igreja.id}/foto/`} onPronto={aoSalvar}>
          <Camera size={18} /> Foto da igreja
        </UploadFoto>
      </div>
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
      <Campo label="Cor da igreja" dica="Aparece como identidade visual (bolinha do evento).">
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200"
            value={form.cor_primaria}
            onChange={set("cor_primaria")}
          />
          <span className="text-sm text-slate-500">{form.cor_primaria}</span>
        </div>
      </Campo>
      <Botao full onClick={salvar} carregando={salvando}>
        <Save size={18} /> Salvar dados
      </Botao>
    </Card>
  );
}
