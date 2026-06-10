import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut, Type, Church, Settings, ShieldCheck, Save, KeyRound, Sun, Moon, Monitor,
} from "lucide-react";
import { getTema, setTema as aplicarTemaPref, type Tema } from "../lib/tema";
import { CampoSenha, FeedbackSenha } from "../components/CampoSenha";
import { MinhasPendencias } from "../components/MinhasPendencias";
import { validarSenha } from "../lib/senha";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Botao, Card, Campo, Avatar, Badge } from "../ui/components";
import { Modal } from "../ui/Modal";
import { UploadFoto } from "../components/UploadFoto";
import { rotulo, formatData, formatHora } from "../lib/format";

export default function Perfil() {
  const { me, recarregar, sair, ehSuper } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tema, setTemaState] = useState<Tema>(getTema());

  const mudarTema = (t: Tema) => {
    setTemaState(t);
    aplicarTemaPref(t);
  };

  const [form, setForm] = useState({
    first_name: me?.profile.first_name || "",
    last_name: me?.profile.last_name || "",
    telefone: me?.profile.telefone || "",
    bio: me?.profile.bio || "",
  });

  if (!me) return null;
  const p = me.profile;
  const ativos = me.vinculos_igreja.filter((v) => v.status === "ativo");

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.patch("/api/auth/me/", form);
      await recarregar();
      toast.sucesso("Perfil atualizado!");
      setEditando(false);
    } catch {
      toast.erro("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const alternarFonte = async () => {
    const novo = !p.fonte_grande;
    document.documentElement.classList.toggle("texto-grande", novo);
    try {
      await api.patch("/api/auth/me/", { fonte_grande: novo });
      await recarregar();
    } catch {
      toast.erro("Erro ao salvar preferência.");
    }
  };

  const logout = () => {
    sair();
    nav("/", { replace: true });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-800">Meu perfil</h1>

      <Card className="flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          <Avatar nome={p.nome} foto={p.foto} size={64} />
          <UploadFoto
            endpoint="/api/auth/me/foto/"
            onPronto={recarregar}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-marca-700 text-white shadow"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-slate-800">{p.nome}</h2>
          <p className="truncate text-slate-500">{p.email}</p>
          {p.last_login && (
            <p className="text-xs text-slate-400">
              Último acesso: {formatData(p.last_login)} {formatHora(p.last_login)}
            </p>
          )}
          {ehSuper && (
            <Badge cor="ouro">
              <ShieldCheck size={14} /> Administrador geral
            </Badge>
          )}
        </div>
      </Card>

      <MinhasPendencias />

      {ehSuper && (
        <Link to="/super">
          <Botao variante="secondary" full>
            <ShieldCheck size={18} /> Administração geral
          </Botao>
        </Link>
      )}

      {/* Minhas igrejas */}
      {ativos.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-600">Minhas igrejas</h2>
          <div className="space-y-2">
            {ativos.map((v) => (
              <Card key={v.igreja} className="flex items-center justify-between p-3">
                <Link to={`/igreja/${v.igreja}`} className="flex items-center gap-2 font-medium text-slate-700">
                  <Church size={18} className="text-marca-600" /> {v.igreja_nome}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge cor="marca">{rotulo.papel(v.papel)}</Badge>
                  {v.eh_lideranca && (
                    <Link to={`/admin/igreja/${v.igreja}`} aria-label="Administrar">
                      <Settings size={18} className="text-slate-400" />
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Editar dados */}
      {editando ? (
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome">
              <input
                className="input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </Campo>
            <Campo label="Sobrenome">
              <input
                className="input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </Campo>
          </div>
          <Campo label="Telefone">
            <input
              className="input"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </Campo>
          <Campo label="Sobre mim">
            <textarea
              className="input min-h-[70px]"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </Campo>
          <div className="flex gap-3">
            <Botao variante="ghost" full onClick={() => setEditando(false)}>
              Cancelar
            </Botao>
            <Botao full onClick={salvar} carregando={salvando}>
              <Save size={18} /> Salvar
            </Botao>
          </div>
        </Card>
      ) : (
        <Botao variante="secondary" full onClick={() => setEditando(true)}>
          Editar meus dados
        </Botao>
      )}

      {/* Acessibilidade */}
      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Type className="text-marca-600" size={22} />
          <div>
            <p className="font-semibold text-slate-700">Fonte grande</p>
            <p className="text-sm text-slate-500">Aumenta o tamanho dos textos.</p>
          </div>
        </div>
        <button
          onClick={alternarFonte}
          role="switch"
          aria-checked={p.fonte_grande}
          className={`relative h-7 w-12 rounded-full transition ${
            p.fonte_grande ? "bg-marca-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              p.fonte_grande ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </Card>

      {/* Tema */}
      <Card className="p-4">
        <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Aparência</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["light", "Claro", Sun],
            ["dark", "Escuro", Moon],
            ["system", "Sistema", Monitor],
          ] as [Tema, string, typeof Sun][]).map(([t, label, Icone]) => (
            <button
              key={t}
              onClick={() => mudarTema(t)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-sm font-semibold transition ${
                tema === t
                  ? "border-marca-600 bg-marca-50 text-marca-700 dark:bg-marca-900/40"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icone size={22} /> {label}
            </button>
          ))}
        </div>
      </Card>

      <Botao variante="secondary" full onClick={() => setTrocarSenha(true)}>
        <KeyRound size={18} /> Trocar senha
      </Botao>

      <Botao variante="ghost" full onClick={logout} className="!text-red-600">
        <LogOut size={18} /> Sair da conta
      </Botao>

      <p className="pb-4 text-center text-xs text-slate-300">IASD Gestão • v1.0</p>

      <TrocarSenha aberto={trocarSenha} aoFechar={() => setTrocarSenha(false)} />
    </div>
  );
}

function TrocarSenha({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const toast = useToast();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [salvando, setSalvando] = useState(false);

  const forca = validarSenha(nova);
  const confere = nova.length > 0 && nova === nova2;
  const podeEnviar = !!atual && forca.ok && confere;

  const submeter = async () => {
    if (!podeEnviar) return;
    setSalvando(true);
    try {
      await api.post("/api/auth/trocar-senha/", { senha_atual: atual, senha_nova: nova });
      toast.sucesso("Senha alterada!");
      setAtual("");
      setNova("");
      setNova2("");
      aoFechar();
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Erro ao trocar senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Trocar senha"
      rodape={
        <>
          <Botao variante="ghost" full onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao full onClick={submeter} carregando={salvando} disabled={!podeEnviar}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <CampoSenha label="Senha atual" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />
        <CampoSenha
          label="Nova senha"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password"
          feedback={
            <FeedbackSenha
              estado={nova.length === 0 ? "vazio" : forca.ok ? "ok" : "erro"}
              texto={nova.length === 0 ? "8+ caracteres, 1 letra e 1 número" : forca.motivo}
            />
          }
        />
        <CampoSenha
          label="Confirmar nova senha"
          value={nova2}
          onChange={(e) => setNova2(e.target.value)}
          autoComplete="new-password"
          feedback={
            <FeedbackSenha
              estado={nova2.length === 0 ? "vazio" : confere ? "ok" : "erro"}
              texto={nova2.length === 0 ? "Repita a nova senha" : confere ? "As senhas conferem" : "As senhas não conferem"}
            />
          }
        />
      </div>
    </Modal>
  );
}
