import { Link } from "react-router-dom";
import { Clock, Church, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../ui/components";
import { tempoDesde } from "../lib/format";

/**
 * Card "Suas solicitações pendentes" — lê dos vínculos do usuário (status
 * pendente) em igrejas e grupos. Não renderiza nada se não houver pendências.
 */
export function MinhasPendencias() {
  const { me } = useAuth();
  if (!me) return null;

  const igrejas = me.vinculos_igreja.filter((v) => v.status === "pendente");
  const grupos = me.vinculos_grupo.filter((v) => v.status === "pendente");
  if (igrejas.length + grupos.length === 0) return null;

  return (
    <Card className="border-2 border-ouro-400 bg-amber-50 p-4 dark:bg-amber-900/20">
      <h2 className="mb-2 flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
        <Clock size={18} /> Suas solicitações pendentes
      </h2>
      <div className="space-y-2">
        {igrejas.map((v) => (
          <Link
            key={`i${v.igreja}`}
            to={`/igreja/${v.igreja}`}
            className="flex items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-800"
          >
            <Church size={16} className="shrink-0 text-marca-600" />
            <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {v.igreja_nome}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{tempoDesde(v.data_entrada)}</span>
          </Link>
        ))}
        {grupos.map((v) => (
          <Link
            key={`g${v.grupo}`}
            to={`/grupo/${v.grupo}`}
            className="flex items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-800"
          >
            <Users size={16} className="shrink-0 text-marca-600" />
            <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {v.grupo_nome}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{tempoDesde(v.data_entrada)}</span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
        ⏳ Aguardando aprovação da liderança.
      </p>
    </Card>
  );
}
