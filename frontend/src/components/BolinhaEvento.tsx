/**
 * Bolinha bicolor de identidade do evento:
 * centro = cor da igreja, anel = cor do grupo (cinza se não tem grupo).
 */
export function BolinhaEvento({
  corIgreja,
  corGrupo,
  size = 14,
  titulo,
}: {
  corIgreja: string;
  corGrupo: string | null;
  size?: number;
  titulo?: string;
}) {
  return (
    <span
      title={titulo}
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: corIgreja || "#16a34a",
        boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * 0.22))}px ${corGrupo || "#94a3b8"}`,
      }}
    />
  );
}
