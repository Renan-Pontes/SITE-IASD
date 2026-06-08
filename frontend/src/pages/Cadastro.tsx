import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registrar, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Botao, Campo } from "../ui/components";
import { CampoSenha, FeedbackSenha } from "../components/CampoSenha";
import { validarSenha } from "../lib/senha";

export default function Cadastro() {
  const { recarregar } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    password: "",
    password2: "",
  });
  const [carregando, setCarregando] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const forca = validarSenha(form.password);
  const confere = form.password.length > 0 && form.password === form.password2;
  const podeEnviar = forca.ok && confere && form.nome.trim() && form.email.trim();

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    setCarregando(true);
    try {
      await registrar({
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim() || undefined,
        password: form.password,
      });
      await recarregar();
      toast.sucesso("Conta criada! Agora escolha sua igreja.");
      nav("/igrejas", { replace: true });
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Não foi possível criar a conta.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-marca-700">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-md sm:max-w-xl">
          <div className="mb-6 text-center text-white">
            <h1 className="text-3xl font-extrabold">Criar conta</h1>
            <p className="mt-1 text-marca-100">Participe da comunidade da sua igreja.</p>
          </div>
          <form
            onSubmit={submeter}
            className="space-y-4 rounded-2xl bg-white p-6 text-slate-800 shadow-xl"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome completo">
                <input
                  className="input"
                  value={form.nome}
                  onChange={set("nome")}
                  required
                  placeholder="Maria da Silva"
                  autoComplete="name"
                />
              </Campo>
              <Campo label="E-mail">
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={set("email")}
                  required
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
              </Campo>
            </div>
            <Campo label="Telefone (opcional)">
              <input
                className="input"
                value={form.telefone}
                onChange={set("telefone")}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoSenha
                label="Senha"
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                feedback={
                  <FeedbackSenha
                    estado={form.password.length === 0 ? "vazio" : forca.ok ? "ok" : "erro"}
                    texto={form.password.length === 0 ? "8+ caracteres, 1 letra e 1 número" : forca.motivo}
                  />
                }
              />
              <CampoSenha
                label="Confirmar senha"
                value={form.password2}
                onChange={set("password2")}
                autoComplete="new-password"
                feedback={
                  <FeedbackSenha
                    estado={form.password2.length === 0 ? "vazio" : confere ? "ok" : "erro"}
                    texto={
                      form.password2.length === 0
                        ? "Repita a senha"
                        : confere
                          ? "As senhas conferem"
                          : "As senhas não conferem"
                    }
                  />
                }
              />
            </div>

            <Botao type="submit" full carregando={carregando} disabled={!podeEnviar}>
              Criar conta
            </Botao>
            <p className="text-center text-sm text-slate-500">
              Já tem conta?{" "}
              <Link to="/entrar" className="font-semibold text-marca-700">
                Entrar
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
