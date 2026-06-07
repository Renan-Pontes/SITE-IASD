import { Link } from "react-router-dom";
import { CalendarDays, Church, Users, Vote } from "lucide-react";

export default function Landing() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-marca-700 to-marca-800 p-7 text-white shadow-md">
        <h1 className="text-3xl font-extrabold leading-tight">
          A agenda da sua igreja, organizada e na palma da mão.
        </h1>
        <p className="mt-2 text-marca-100">
          Veja a programação, confirme presença, participe de grupos e acompanhe as
          decisões da Igreja Adventista do Sétimo Dia.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link to="/cadastro" className="btn-ouro flex-1">
            Criar minha conta
          </Link>
          <Link to="/entrar" className="btn-secondary flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20">
            Entrar
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[
          { i: CalendarDays, t: "Agenda completa", d: "Eventos de todas as igrejas num calendário." },
          { i: Church, t: "Várias igrejas", d: "Encontre programação por proximidade." },
          { i: Users, t: "Grupos e ministérios", d: "Participe, converse e cresça." },
          { i: Vote, t: "Pautas dos anciões", d: "Decisões com votação organizada." },
        ].map(({ i: Icone, t, d }) => (
          <div key={t} className="card p-4">
            <Icone className="mb-2 text-marca-600" size={28} />
            <h3 className="font-bold text-slate-800">{t}</h3>
            <p className="text-sm text-slate-500">{d}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/igrejas" className="btn-secondary flex-1">
          Ver igrejas
        </Link>
        <Link to="/agenda" className="btn-secondary flex-1">
          Ver agenda pública
        </Link>
      </div>
    </div>
  );
}
