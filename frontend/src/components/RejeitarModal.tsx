import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Botao } from "../ui/components";

/**
 * Modal de rejeição com motivo opcional. Chama `aoConfirmar(motivo)`.
 */
export function RejeitarModal({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo = "Recusar pedido",
  mensagem = "O usuário será avisado. Você pode incluir um motivo (opcional).",
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
  titulo?: string;
  mensagem?: string;
}) {
  const [motivo, setMotivo] = useState("");

  const confirmar = () => {
    aoConfirmar(motivo.trim());
    setMotivo("");
  };

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
          <Botao variante="perigo" full onClick={confirmar}>
            Recusar
          </Botao>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{mensagem}</p>
      <textarea
        className="input min-h-[90px]"
        placeholder="Motivo (opcional)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
    </Modal>
  );
}
