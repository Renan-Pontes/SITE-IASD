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
}

const Ctx = createContext<AuthState>(null as any);

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [carregando, setCarregando] = useState(true);

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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
