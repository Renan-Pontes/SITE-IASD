import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Carregando } from "./ui/components";

import Entrar from "./pages/Entrar";
import Cadastro from "./pages/Cadastro";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Agenda from "./pages/Agenda";
import Igrejas from "./pages/Igrejas";
import IgrejaDetalhe from "./pages/IgrejaDetalhe";
import Grupos from "./pages/Grupos";
import GrupoDetalhe from "./pages/GrupoDetalhe";
import EventoDetalhe from "./pages/EventoDetalhe";
import EventoForm from "./pages/EventoForm";
import Pautas from "./pages/Pautas";
import PautaDetalhe from "./pages/PautaDetalhe";
import Aprovacoes from "./pages/Aprovacoes";
import Notificacoes from "./pages/Notificacoes";
import Perfil from "./pages/Perfil";
import AdminIgreja from "./pages/AdminIgreja";

function RequireAuth({ children }: { children: ReactNode }) {
  const { logado, carregando } = useAuth();
  const loc = useLocation();
  if (carregando) return <Carregando />;
  if (!logado) return <Navigate to="/entrar" state={{ de: loc.pathname }} replace />;
  return <>{children}</>;
}

function Inicio() {
  const { logado, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return logado ? <Dashboard /> : <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        {/* Públicas (visitante pode ver) */}
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/igrejas" element={<Igrejas />} />
        <Route path="/igreja/:id" element={<IgrejaDetalhe />} />
        <Route path="/evento/:id" element={<EventoDetalhe />} />

        {/* Exigem login */}
        <Route path="/grupos" element={<RequireAuth><Grupos /></RequireAuth>} />
        <Route path="/grupo/:id" element={<RequireAuth><GrupoDetalhe /></RequireAuth>} />
        <Route path="/evento/novo" element={<RequireAuth><EventoForm /></RequireAuth>} />
        <Route path="/evento/:id/editar" element={<RequireAuth><EventoForm /></RequireAuth>} />
        <Route path="/pautas" element={<RequireAuth><Pautas /></RequireAuth>} />
        <Route path="/pauta/:id" element={<RequireAuth><PautaDetalhe /></RequireAuth>} />
        <Route path="/aprovacoes" element={<RequireAuth><Aprovacoes /></RequireAuth>} />
        <Route path="/notificacoes" element={<RequireAuth><Notificacoes /></RequireAuth>} />
        <Route path="/perfil" element={<RequireAuth><Perfil /></RequireAuth>} />
        <Route path="/admin/igreja/:id" element={<RequireAuth><AdminIgreja /></RequireAuth>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
