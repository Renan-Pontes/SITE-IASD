import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/**
 * Botão "Criar evento" que só aparece para quem pode criar (líder de grupo,
 * líder de igreja ou ancião). Para membros comuns/visitantes, não renderiza nada.
 *
 * `variante`:
 *  - "primary" (padrão): botão de destaque.
 *  - "fab": botão flutuante redondo (mobile).
 *  - "sidebar": botão largo da barra lateral.
 */
export function BotaoCriarEvento({
  variante = "primary",
  className = "",
}: {
  variante?: "primary" | "fab" | "sidebar";
  className?: string;
}) {
  const { podeCriarEvento } = useAuth();
  if (!podeCriarEvento) return null;

  if (variante === "fab") {
    return (
      <Link
        to="/evento/novo"
        className={`btn-primary fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full !p-0 shadow-lg lg:hidden ${className}`}
        aria-label="Criar evento"
        title="Criar evento"
      >
        <Plus size={26} />
      </Link>
    );
  }

  if (variante === "sidebar") {
    return (
      <Link to="/evento/novo" className={`btn-primary w-full !py-2.5 ${className}`} title="Criar evento">
        <Plus size={18} /> Criar evento
      </Link>
    );
  }

  return (
    <Link to="/evento/novo" className={`btn-primary ${className}`} title="Criar evento">
      <Plus size={18} /> Criar evento
    </Link>
  );
}
