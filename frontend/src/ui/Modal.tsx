import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { Botao } from "./components";

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {titulo && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
            <button onClick={aoFechar} aria-label="Fechar" className="text-slate-400">
              <X size={24} />
            </button>
          </div>
        )}
        <div>{children}</div>
        {rodape && <div className="mt-5 flex gap-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function Confirmacao({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo,
  mensagem,
  confirmarTexto = "Confirmar",
  perigo = false,
  carregando = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  titulo: string;
  mensagem: string;
  confirmarTexto?: string;
  perigo?: boolean;
  carregando?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="ghost" full onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante={perigo ? "perigo" : "primary"}
            full
            onClick={aoConfirmar}
            carregando={carregando}
          >
            {confirmarTexto}
          </Botao>
        </>
      }
    >
      <p className="text-slate-600">{mensagem}</p>
    </Modal>
  );
}
