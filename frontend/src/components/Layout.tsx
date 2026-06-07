import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, CalendarDays, Church, Users, Bell, User } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Avatar } from "../ui/components";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-700 font-extrabold text-white">
        ✛
      </div>
      <span className="text-lg font-extrabold tracking-tight text-marca-800">
        IASD <span className="font-medium text-slate-500">Gestão</span>
      </span>
    </Link>
  );
}

function TopBar() {
  const { me, logado } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    const carregar = () =>
      api
        .get<{ total: number }>("/api/notificacoes/nao_lidas/")
        .then((d) => vivo && setNaoLidas(d.total))
        .catch(() => {});
    carregar();
    const t = setInterval(carregar, 30000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [logado]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Logo />
        {logado && (
          <div className="flex items-center gap-1">
            <Link
              to="/notificacoes"
              className="relative rounded-full p-2 hover:bg-slate-100"
              aria-label="Notificações"
            >
              <Bell size={24} className="text-slate-600" />
              {naoLidas > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </Link>
            <Link to="/perfil" aria-label="Meu perfil">
              <Avatar nome={me?.profile.nome || "?"} foto={me?.profile.foto} size={36} />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const itens = [
    { to: "/", icone: Home, texto: "Início", end: true },
    { to: "/agenda", icone: CalendarDays, texto: "Agenda" },
    { to: "/igrejas", icone: Church, texto: "Igrejas" },
    { to: "/grupos", icone: Users, texto: "Grupos" },
    { to: "/perfil", icone: User, texto: "Perfil" },
  ];
  return (
    <nav className="sticky bottom-0 z-30 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {itens.map(({ to, icone: Icone, texto, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                isActive ? "text-marca-700" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <Icone size={24} />
            {texto}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  // rola para o topo ao trocar de página
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
