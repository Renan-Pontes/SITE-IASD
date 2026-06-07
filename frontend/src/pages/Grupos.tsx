import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Grupo } from "../lib/types";
import { Card, Badge, SkeletonLista, Vazio } from "../ui/components";
import { rotulo } from "../lib/format";

export default function Grupos() {
  const { me } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const igrejas = (me?.vinculos_igreja || [])
      .filter((v) => v.status === "ativo")
      .map((v) => v.igreja);
    if (igrejas.length === 0) {
      setCarregando(false);
      return;
    }
    Promise.all(igrejas.map((id) => api.get<Grupo[]>(`/api/igrejas/${id}/grupos/`)))
      .then((listas) => {
        const todos = listas.flat();
        const unicos = Array.from(new Map(todos.map((g) => [g.id, g])).values());
        setGrupos(unicos);
      })
      .finally(() => setCarregando(false));
  }, [me]);

  const meus = grupos.filter((g) => g.meu_status === "ativo" || g.meu_status === "pendente");
  const outros = grupos.filter((g) => !g.meu_status);

  const renderGrupo = (g: Grupo) => (
    <Link key={g.id} to={`/grupo/${g.id}`}>
      <Card className="flex items-center gap-4 p-4 hover:shadow-md">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-marca-700">
          <Users size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-800">{g.nome}</h3>
          <p className="text-sm text-slate-500">
            {rotulo.tipoGrupo(g.tipo)} • {g.igreja_nome}
          </p>
        </div>
        {g.meu_status === "ativo" && <Badge cor="marca">{rotulo.cargo(g.meu_cargo || "membro")}</Badge>}
        {g.meu_status === "pendente" && <Badge cor="ouro">⏳ Aguardando</Badge>}
      </Card>
    </Link>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-800">Grupos</h1>

      {carregando ? (
        <SkeletonLista n={3} />
      ) : grupos.length === 0 ? (
        <Vazio
          titulo="Nenhum grupo disponível"
          descricao="Entre em uma igreja para ver e participar dos grupos dela."
        />
      ) : (
        <>
          {meus.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold text-slate-600">Meus grupos</h2>
              <div className="space-y-3">{meus.map(renderGrupo)}</div>
            </section>
          )}
          {outros.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold text-slate-600">Descobrir</h2>
              <div className="space-y-3">{outros.map(renderGrupo)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
