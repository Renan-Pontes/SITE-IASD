// Formatação de datas/horas em pt-BR e rótulos amigáveis dos enums.

const tz = "America/Sao_Paulo";

export function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: tz,
  });
}

export function formatDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: tz,
  });
}

export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function formatDiaSemana(iso: string): string {
  const s = new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: tz,
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatIntervalo(inicio: string, fim: string): string {
  const di = new Date(inicio);
  const df = new Date(fim);
  const mesmoDia = di.toDateString() === df.toDateString();
  if (mesmoDia) {
    return `${formatData(inicio)} • ${formatHora(inicio)} às ${formatHora(fim)}`;
  }
  return `${formatData(inicio)} ${formatHora(inicio)} → ${formatData(fim)} ${formatHora(fim)}`;
}

export function ehHoje(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function ehFuturo(iso: string): boolean {
  return new Date(iso).getTime() >= Date.now();
}

const PAPEL: Record<string, string> = {
  visitante: "Visitante",
  membro: "Membro",
  anciao: "Ancião",
  pastor: "Pastor",
  admin_igreja: "Administrador",
};
const CARGO: Record<string, string> = {
  membro: "Membro",
  secretario: "Secretário",
  lider: "Líder",
  diretor: "Diretor",
};
const STATUS_VINCULO: Record<string, string> = {
  pendente: "Pendente",
  ativo: "Ativo",
  rejeitado: "Rejeitado",
  inativo: "Inativo",
};
const STATUS_EVENTO: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  cancelado: "Cancelado",
};
const TIPO_GRUPO: Record<string, string> = {
  ministerio: "Ministério",
  classe: "Classe / Escola Sabatina",
  desbravadores: "Desbravadores",
  aventureiros: "Aventureiros",
  musica: "Música / Louvor",
  jovens: "Jovens",
  outro: "Outro",
};
const RSVP: Record<string, string> = {
  confirmado: "Confirmado",
  talvez: "Talvez",
  cancelado: "Não vou",
};

export const rotulo = {
  papel: (v: string) => PAPEL[v] ?? v,
  cargo: (v: string) => CARGO[v] ?? v,
  statusVinculo: (v: string) => STATUS_VINCULO[v] ?? v,
  statusEvento: (v: string) => STATUS_EVENTO[v] ?? v,
  tipoGrupo: (v: string) => TIPO_GRUPO[v] ?? v,
  rsvp: (v: string) => RSVP[v] ?? v,
};

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
