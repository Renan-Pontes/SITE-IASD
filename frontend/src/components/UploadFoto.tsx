import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadArquivo, ApiError } from "../api/client";
import { useToast } from "../ui/Toast";

/**
 * Botão de upload de imagem reutilizável.
 * Envia para `endpoint` (multipart, campo "foto") e devolve o objeto atualizado.
 */
export function UploadFoto({
  endpoint,
  onPronto,
  children,
  className = "",
}: {
  endpoint: string;
  onPronto?: (obj: any) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const escolher = () => inputRef.current?.click();

  const aoSelecionar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.erro("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setEnviando(true);
    try {
      const obj = await uploadArquivo(endpoint, file);
      toast.sucesso("Foto atualizada!");
      onPronto?.(obj);
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Erro ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={escolher}
        disabled={enviando}
        className={className || "btn-secondary"}
        aria-label="Trocar foto"
      >
        {enviando ? <Loader2 className="animate-spin" size={20} /> : children || <Camera size={20} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={aoSelecionar}
      />
    </>
  );
}
