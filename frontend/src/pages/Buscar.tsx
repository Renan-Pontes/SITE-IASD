import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Church, Users, CalendarDays, User as UserIcon } from "lucide-react";
import { api } from "../api/client";
import type { Evento, Grupo, Igreja, UsuarioMini } from "../lib/types";
import { Card, Carregando, Vazio, Avatar, Badge } from "../ui/components";
import { formatData, formatHora, rotulo } from "../lib/format";

interface Resultado {
  igrejas: Igreja[];
  grupos: Grupo[];
  eventos: Evento[];
  pessoas: UsuarioMini[];
}

export default function Buscar() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Busca com debounce.
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) {
      setRes(null);
      return;
    }
    setCarregando(true);
    const t = setTimeout(() => {
      api
        .get<Resultado>(`/api/search/?q=${encodeURIComponent(termo)}`)
        .then(setRes)
        .finally(() => setCarregando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const vazio =
    res &&
    res.igrejas.length === 0 &&
    res.grupos.length === 0 &&
    res.eventos.length === 0 &&
    res.pessoas.length === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Buscar</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          ref={inputRef}
          className="input pl-10"
          placeholder="Igrejas, grupos, eventos, pessoas..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {carregando && <Carregando texto="Buscando..." />}

      {!carregando && q.trim().length >= 2 && vazio && (
        <Vazio titulo="Nada encontrado" descricao={`Nenhum resultado para “${q}”.`} />
      )}

      {!carregando && res && (
        <div className="space-y-6">
          {res.igrejas.length > 0 && (
            <Secao titulo="Igrejas" icone={<Church size={18} />}>
              {res.igrejas.map((ig) => (
                <Link key={ig.id} to={`/igreja/${ig.id}`}>
                  <Card className="flex items-center gap-3 p-3 hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-100">⛪</div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{ig.nome}</p>
                      <p className="text-sm text-slate-500">{ig.cidade}{ig.estado && `/${ig.estado}`}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </Secao>
          )}

          {res.eventos.length > 0 && (
            <Secao titulo="Eventos" icone={<CalendarDays size={18} />}>
              {res.eventos.map((ev) => (
                <Link key={ev.id} to={`/evento/${ev.id}`}>
                  <Card className="p-3 hover:shadow-md">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{ev.titulo}</p>
                    <p className="text-sm text-slate-500">
                      {ev.igreja_nome} • {formatData(ev.inicio)} {formatHora(ev.inicio)}
                    </p>
                  </Card>
                </Link>
              ))}
            </Secao>
          )}

          {res.grupos.length > 0 && (
            <Secao titulo="Grupos" icone={<Users size={18} />}>
              {res.grupos.map((g) => (
                <Link key={g.id} to={`/grupo/${g.id}`}>
                  <Card className="flex items-center justify-between p-3 hover:shadow-md">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{g.nome}</p>
                      <p className="text-sm text-slate-500">{g.igreja_nome}</p>
                    </div>
                    <Badge cor="cinza">{rotulo.tipoGrupo(g.tipo)}</Badge>
                  </Card>
                </Link>
              ))}
            </Secao>
          )}

          {res.pessoas.length > 0 && (
            <Secao titulo="Pessoas" icone={<UserIcon size={18} />}>
              {res.pessoas.map((p) => (
                <Card key={p.id} className="flex items-center gap-3 p-3">
                  <Avatar nome={p.nome} foto={p.foto} size={36} />
                  <p className="font-medium text-slate-700 dark:text-slate-200">{p.nome}</p>
                </Card>
              ))}
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300">
        {icone} {titulo}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
