import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Campo de senha com botão "mostrar/ocultar" (ícone de olho) e área de
 * feedback opcional (mensagem colorida embaixo).
 */
export function CampoSenha({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  feedback,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  placeholder?: string;
  feedback?: ReactNode;
}) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative">
        <input
          type={mostrar ? "text" : "password"}
          className="input pr-12"
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setMostrar((m) => !m)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
        >
          {mostrar ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {feedback}
    </label>
  );
}

/** Mensagem de feedback colorida (vazio/ok/erro). */
export function FeedbackSenha({ estado, texto }: { estado: "vazio" | "ok" | "erro"; texto: string }) {
  if (!texto) return null;
  const cor =
    estado === "ok"
      ? "text-marca-700"
      : estado === "erro"
        ? "text-red-600"
        : "text-slate-400";
  return (
    <span className={`mt-1 block text-xs font-medium ${cor}`}>
      {estado === "ok" ? "✓ " : ""}
      {texto}
    </span>
  );
}
