import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registrar } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Botao, Campo } from "../ui/components";
import { ApiError } from "../api/client";

export default function Cadastro() {
  const { recarregar } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", password: "" });
  const [carregando, setCarregando] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const msg =
        err instanceof ApiError ? err.message : "Não foi possível criar a conta.";
      toast.erro(msg);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-marca-700">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center text-white">
            <h1 className="text-3xl font-extrabold">Criar conta</h1>
            <p className="mt-1 text-marca-100">Participe da comunidade da sua igreja.</p>
          </div>
          <form
            onSubmit={submeter}
            className="space-y-4 rounded-2xl bg-white p-6 text-slate-800 shadow-xl"
          >
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
            <Campo label="Telefone (opcional)">
              <input
                className="input"
                value={form.telefone}
                onChange={set("telefone")}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </Campo>
            <Campo label="Senha" dica="Mínimo de 6 caracteres.">
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={set("password")}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </Campo>
            <Botao type="submit" full carregando={carregando}>
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
