import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, tokens, login as apiLogin, logout as apiLogout } from "../api/client";
import type { Me } from "../lib/types";

interface AuthState {
  me: Me | null;
  carregando: boolean;
  logado: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  recarregar: () => Promise<void>;
  // Helpers de papel
  ehSuper: boolean;
  souLideranca: boolean;
  lideroIgreja: (igrejaId: number) => boolean;
  souLiderIgreja: (igrejaId: number) => boolean;
  souSecretaria: (igrejaId: number) => boolean;
  // Configuração pública (modo mono-igreja)
  multiChurch: boolean;
  igrejaUnica: IgrejaUnica | null;
}

interface IgrejaUnica {
  id: number;
  nome: string;
  slug: string;
  cor_primaria: string;
}

const Ctx = createContext<AuthState>(null as any);

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Configuração pública (modo mono-igreja). Default multi=true até carregar,
  // para nunca esconder navegação por engano antes da resposta.
  const [multiChurch, setMultiChurch] = useState(true);
  const [igrejaUnica, setIgrejaUnica] = useState<IgrejaUnica | null>(null);

  useEffect(() => {
    api
      .get<{ multi_church_enabled: boolean; igreja_unica: IgrejaUnica | null }>("/api/config/")
      .then((c) => {
        setMultiChurch(c.multi_church_enabled);
        setIgrejaUnica(c.igreja_unica);
      })
      .catch(() => {});
  }, []);

  const carregarMe = useCallback(async () => {
    if (!tokens.access) {
      setMe(null);
      setCarregando(false);
      return;
    }
    try {
      const data = await api.get<Me>("/api/auth/me/");
      setMe(data);
      // Aplica preferência de fonte grande (acessibilidade).
      document.documentElement.classList.toggle(
        "texto-grande",
        !!data.profile.fonte_grande,
      );
    } catch {
      setMe(null);
      apiLogout();
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarMe();
  }, [carregarMe]);

  const entrar = async (email: string, senha: string) => {
    await apiLogin(email, senha);
    await carregarMe();
  };

  const sair = () => {
    apiLogout();
    setMe(null);
    document.documentElement.classList.remove("texto-grande");
  };

  const ehSuper = !!me?.is_super_admin;
  const souLideranca =
    ehSuper || !!me?.vinculos_igreja.some((v) => v.eh_lideranca && v.status === "ativo");
  const lideroIgreja = (igrejaId: number) =>
    ehSuper ||
    !!me?.vinculos_igreja.some(
      (v) => v.igreja === igrejaId && v.eh_lideranca && v.status === "ativo",
    );
  // Líder de igreja (papel próprio, dono do Canal da Liderança).
  const souLiderIgreja = (igrejaId: number) =>
    !!me?.vinculos_igreja.some(
      (v) => v.igreja === igrejaId && v.papel === "lider_igreja" && v.status === "ativo",
    );
  // Cargo de secretaria (paralelo ao papel).
  const souSecretaria = (igrejaId: number) =>
    ehSuper ||
    !!me?.vinculos_igreja.some(
      (v) => v.igreja === igrejaId && v.secretaria && v.status === "ativo",
    );

  return (
    <Ctx.Provider
      value={{
        me,
        carregando,
        logado: !!me,
        entrar,
        sair,
        recarregar: carregarMe,
        ehSuper,
        souLideranca,
        lideroIgreja,
        souLiderIgreja,
        souSecretaria,
        multiChurch,
        igrejaUnica,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
