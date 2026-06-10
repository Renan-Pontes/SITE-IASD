import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { Botao, Campo } from "../ui/components";
import { CampoSenha } from "../components/CampoSenha";
import { ApiError, api } from "../api/client";

export default function Entrar() {
  const { entrar } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [inativo, setInativo] = useState(false);
  const [reativando, setReativando] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setInativo(false);
    try {
      await entrar(email.trim(), senha);
      toast.sucesso("Bem-vindo de volta!");
      nav(loc.state?.de || "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.data?.inativo) {
        setInativo(true);
        toast.erro(err.message);
      } else {
        toast.erro(
          err instanceof ApiError && err.status === 401
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente novamente.",
        );
      }
    } finally {
      setCarregando(false);
    }
  };

  const solicitarReativacao = async () => {
    setReativando(true);
    try {
      await api.post("/api/auth/solicitar-reativacao/", { email: email.trim() });
      toast.sucesso("Pedido enviado. A liderança da sua igreja vai avaliar.");
      setInativo(false);
    } catch {
      toast.erro("Não foi possível enviar o pedido.");
    } finally {
      setReativando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-marca-700">
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl">
              ✛
            </div>
            <h1 className="text-3xl font-extrabold">IASD Gestão</h1>
            <p className="mt-1 text-marca-100">A agenda da sua igreja, num só lugar.</p>
          </div>

          <form
            onSubmit={submeter}
            className="space-y-4 rounded-2xl bg-white p-6 text-slate-800 shadow-xl"
          >
            <h2 className="text-xl font-bold">Entrar</h2>
            <Campo label="E-mail">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="voce@email.com"
              />
            </Campo>
            <CampoSenha
              label="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
            <Botao type="submit" full carregando={carregando}>
              Entrar
            </Botao>

            {inativo && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Conta desativada por inatividade.</p>
                <p className="mt-1">
                  Você pode pedir a reativação — a liderança da sua igreja é avisada.
                </p>
                <Botao
                  type="button"
                  variante="secondary"
                  className="mt-2"
                  onClick={solicitarReativacao}
                  carregando={reativando}
                >
                  Solicitar reativação
                </Botao>
              </div>
            )}
            <p className="text-center text-sm text-slate-500">
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="font-semibold text-marca-700">
                Cadastre-se
              </Link>
            </p>
            <Link
              to="/igrejas"
              className="block text-center text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              Ver programação como visitante →
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
