import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type Tipo = "sucesso" | "erro" | "info";
interface Toast {
  id: number;
  tipo: Tipo;
  texto: string;
}

const ToastCtx = createContext<{
  sucesso: (t: string) => void;
  erro: (t: string) => void;
  info: (t: string) => void;
}>({ sucesso: () => {}, erro: () => {}, info: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (tipo: Tipo, texto: string) => {
      const id = seq++;
      setToasts((ts) => [...ts, { id, tipo, texto }]);
      setTimeout(() => remover(id), 4500);
    },
    [remover],
  );

  const value = {
    sucesso: (t: string) => add("sucesso", t),
    erro: (t: string) => add("erro", t),
    info: (t: string) => add("info", t),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-white ${
              t.tipo === "sucesso"
                ? "bg-marca-700"
                : t.tipo === "erro"
                  ? "bg-red-600"
                  : "bg-slate-800"
            }`}
          >
            {t.tipo === "sucesso" && <CheckCircle2 className="mt-0.5 shrink-0" size={22} />}
            {t.tipo === "erro" && <XCircle className="mt-0.5 shrink-0" size={22} />}
            {t.tipo === "info" && <Info className="mt-0.5 shrink-0" size={22} />}
            <span className="flex-1 text-sm font-medium leading-snug">{t.texto}</span>
            <button onClick={() => remover(t.id)} aria-label="Fechar" className="shrink-0">
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
