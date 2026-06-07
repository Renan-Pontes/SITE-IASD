import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { Loader2, Inbox } from "lucide-react";
import { iniciais } from "../lib/format";

// --- Botão ---
type Variante = "primary" | "ouro" | "secondary" | "ghost" | "perigo";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  full?: boolean;
}
export function Botao({
  variante = "primary",
  carregando,
  full,
  children,
  className = "",
  disabled,
  ...rest
}: BtnProps) {
  const cls = {
    primary: "btn-primary",
    ouro: "btn-ouro",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    perigo: "btn-perigo",
  }[variante];
  return (
    <button
      className={`${cls} ${full ? "w-full" : ""} ${className}`}
      disabled={disabled || carregando}
      {...rest}
    >
      {carregando && <Loader2 className="animate-spin" size={20} />}
      {children}
    </button>
  );
}

// --- Card ---
export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`card ${onClick ? "cursor-pointer hover:shadow-md transition" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// --- Badge / chip ---
export function Badge({
  children,
  cor = "marca",
}: {
  children: ReactNode;
  cor?: "marca" | "ouro" | "cinza" | "vermelho" | "azul";
}) {
  const cores = {
    marca: "bg-marca-100 text-marca-800",
    ouro: "bg-amber-100 text-amber-800",
    cinza: "bg-slate-100 text-slate-600",
    vermelho: "bg-red-100 text-red-700",
    azul: "bg-blue-100 text-blue-700",
  }[cor];
  return <span className={`chip ${cores}`}>{children}</span>;
}

// --- Avatar ---
export function Avatar({
  nome,
  foto,
  size = 44,
}: {
  nome: string;
  foto?: string | null;
  size?: number;
}) {
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-marca-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {iniciais(nome)}
    </div>
  );
}

// --- Spinner de página ---
export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="animate-spin text-marca-600" size={36} />
      <span>{texto}</span>
    </div>
  );
}

// --- Skeleton ---
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

export function SkeletonLista({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

// --- Estado vazio ---
export function Vazio({
  titulo,
  descricao,
  icone,
  acao,
}: {
  titulo: string;
  descricao?: string;
  icone?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-12 px-6 text-center">
      <div className="text-marca-400">{icone || <Inbox size={48} />}</div>
      <h3 className="text-lg font-semibold text-slate-700">{titulo}</h3>
      {descricao && <p className="max-w-sm text-sm text-slate-500">{descricao}</p>}
      {acao}
    </div>
  );
}

// --- Campo de formulário ---
export function Campo({
  label,
  children,
  dica,
}: {
  label: string;
  children: ReactNode;
  dica?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  );
}
