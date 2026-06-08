import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, CalendarDays, Church, Users, Bell, User, Search } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Avatar } from "../ui/components";

// Itens de navegação compartilhados entre a bottom-nav (mobile) e a sidebar (desktop).
const ITENS = [
  { to: "/", icone: Home, texto: "Início", end: true },
  { to: "/agenda", icone: CalendarDays, texto: "Agenda" },
  { to: "/igrejas", icone: Church, texto: "Igrejas" },
  { to: "/grupos", icone: Users, texto: "Grupos" },
  { to: "/buscar", icone: Search, texto: "Buscar" },
  { to: "/perfil", icone: User, texto: "Perfil" },
];
// Mobile mostra 5 (Buscar fica na barra superior).
const ITENS_MOBILE = ITENS.filter((i) => i.to !== "/buscar");

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-700 font-extrabold text-white">
        ✛
      </div>
      <span className="text-lg font-extrabold tracking-tight text-marca-800 dark:text-marca-300">
        IASD <span className="font-medium text-slate-500">Gestão</span>
      </span>
    </Link>
  );
}

// Contador de notificações não lidas (compartilhado).
function useNaoLidas() {
  const { logado } = useAuth();
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
  return naoLidas;
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
      {n > 9 ? "9+" : n}
    </span>
  );
}

// --- Barra superior (mobile) ---
function TopBar({ naoLidas }: { naoLidas: number }) {
  const { me, logado } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-1">
          <Link to="/buscar" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Buscar">
            <Search size={24} className="text-slate-600 dark:text-slate-300" />
          </Link>
          {logado ? (
            <>
              <Link to="/notificacoes" className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Notificações">
                <Bell size={24} className="text-slate-600 dark:text-slate-300" />
                <span className="absolute -right-0.5 -top-0.5">
                  <Badge n={naoLidas} />
                </span>
              </Link>
              <Link to="/perfil" aria-label="Meu perfil">
                <Avatar nome={me?.profile.nome || "?"} foto={me?.profile.foto} size={36} />
              </Link>
            </>
          ) : (
            <Link to="/entrar" className="btn-primary !px-4 !py-2 text-sm">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// --- Barra inferior (mobile) ---
function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-slate-100 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 lg:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {ITENS_MOBILE.map(({ to, icone: Icone, texto, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                isActive ? "text-marca-700 dark:text-marca-300" : "text-slate-400 hover:text-slate-600"
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

// --- Barra lateral (desktop ≥ lg) ---
function Sidebar({ naoLidas }: { naoLidas: number }) {
  const { me, logado } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-100 bg-white dark:border-slate-800 lg:flex">
      <div className="p-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITENS.map(({ to, icone: Icone, texto, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold transition ${
                isActive
                  ? "bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            <Icone size={22} />
            {texto}
          </NavLink>
        ))}
        {logado && (
          <NavLink
            to="/notificacoes"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold transition ${
                isActive
                  ? "bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            <Bell size={22} />
            <span className="flex-1">Notificações</span>
            <Badge n={naoLidas} />
          </NavLink>
        )}
      </nav>
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        {logado ? (
          <Link to="/perfil" className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Avatar nome={me?.profile.nome || "?"} foto={me?.profile.foto} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {me?.profile.nome}
              </p>
              <p className="truncate text-xs text-slate-400">{me?.profile.email}</p>
            </div>
          </Link>
        ) : (
          <Link to="/entrar" className="btn-primary w-full">
            Entrar
          </Link>
        )}
      </div>
    </aside>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const naoLidas = useNaoLidas();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <div className="lg:flex">
      <Sidebar naoLidas={naoLidas} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar naoLidas={naoLidas} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 lg:max-w-5xl lg:px-8 lg:py-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
