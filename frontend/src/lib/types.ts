// Tipos espelhando a API DRF.

export type StatusVinculo = "pendente" | "ativo" | "rejeitado" | "inativo";
export type PapelIgreja =
  | "visitante"
  | "membro"
  | "lider_igreja"
  | "anciao"
  | "pastor"
  | "admin_igreja";
export type CargoGrupo = "membro" | "secretario" | "lider" | "diretor";
export type StatusEvento =
  | "rascunho"
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "cancelado";
export type Visibilidade = "publico" | "privado";
export type Recorrencia = "nenhuma" | "diaria" | "semanal" | "mensal";
export type StatusInscricao = "confirmado" | "talvez" | "cancelado";
export type OpcaoVoto = "sim" | "nao" | "abstencao";

export interface UsuarioMini {
  id: number;
  nome: string;
  foto: string | null;
}

export interface Profile {
  id: number;
  username: string;
  email: string;
  nome: string;
  first_name: string;
  last_name: string;
  telefone: string;
  foto: string | null;
  bio: string;
  igreja_principal: number | null;
  igreja_principal_nome: string | null;
  latitude: number | null;
  longitude: number | null;
  is_super_admin: boolean;
  fonte_grande: boolean;
  notificacoes_email: boolean;
}

export interface VinculoIgreja {
  igreja: number;
  igreja_nome: string;
  papel: PapelIgreja;
  secretaria: boolean;
  status: StatusVinculo;
  eh_lideranca: boolean;
  motivo_rejeicao: string;
  data_entrada: string;
}

export interface VinculoGrupo {
  grupo: number;
  grupo_nome: string;
  igreja: number;
  cargo: CargoGrupo;
  status: StatusVinculo;
  eh_lideranca: boolean;
  motivo_rejeicao: string;
  data_entrada: string;
}

export interface Me {
  profile: Profile;
  vinculos_igreja: VinculoIgreja[];
  vinculos_grupo: VinculoGrupo[];
  is_super_admin: boolean;
}

export interface Igreja {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number | null;
  longitude: number | null;
  telefone: string;
  email: string;
  foto: string | null;
  cor_primaria: string;
  ativo: boolean;
  total_membros: number;
  distancia_km: number | null;
  meu_status: StatusVinculo | null;
  meu_papel: PapelIgreja | null;
  eu_sigo: boolean;
  criado_em: string;
}

export interface Membro {
  id: number;
  usuario: number;
  usuario_detalhe: UsuarioMini;
  igreja: number;
  igreja_nome: string;
  papel: PapelIgreja;
  secretaria: boolean;
  status: StatusVinculo;
  motivo_rejeicao: string;
  data_entrada: string;
}

export interface Ata {
  id: number;
  pauta: number | null;
  pauta_titulo: string | null;
  igreja: number;
  igreja_nome: string;
  titulo: string;
  conteudo: string;
  status: "rascunho" | "publicada";
  criada_por: number | null;
  criada_por_detalhe: UsuarioMini | null;
  publicada_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Grupo {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  tipo: string;
  igreja: number;
  igreja_nome: string;
  foto: string | null;
  cor: string;
  ativo: boolean;
  total_membros: number;
  meu_status: StatusVinculo | null;
  meu_cargo: CargoGrupo | null;
  criado_em: string;
}

export interface GrupoMembro {
  id: number;
  usuario: number;
  usuario_detalhe: UsuarioMini;
  grupo: number;
  grupo_nome: string;
  cargo: CargoGrupo;
  status: StatusVinculo;
  motivo_rejeicao: string;
  data_entrada: string;
}

export interface Sala {
  id: number;
  nome: string;
  igreja: number;
  igreja_nome: string;
  capacidade: number | null;
  equipamentos: string;
  ativo: boolean;
}

export interface Evento {
  id: number;
  titulo: string;
  descricao: string;
  igreja: number;
  igreja_nome: string;
  cor_igreja: string;
  cor_grupo: string | null;
  grupo: number | null;
  grupo_nome: string | null;
  sala: number | null;
  sala_nome: string | null;
  inicio: string;
  fim: string;
  visibilidade: Visibilidade;
  status: StatusEvento;
  recorrencia: Recorrencia;
  recorrencia_ate: string | null;
  foto: string | null;
  criado_por: number | null;
  criado_por_detalhe: UsuarioMini | null;
  aprovado_por: number | null;
  motivo_rejeicao: string;
  total_confirmados: number;
  meu_rsvp: StatusInscricao | null;
  posso_aprovar: boolean;
  criado_em: string;
}

export interface Inscricao {
  id: number;
  usuario: number;
  usuario_detalhe: UsuarioMini;
  evento: number;
  evento_titulo: string;
  status: StatusInscricao;
  criado_em: string;
}

export interface Pauta {
  id: number;
  titulo: string;
  descricao: string;
  igreja: number;
  igreja_nome: string;
  criada_por: number | null;
  criada_por_detalhe: UsuarioMini | null;
  tipo: TipoPauta;
  categoria: string;
  canal: "anciaos" | "lideranca";
  metodo_votacao: string;
  pode_votar: boolean;
  payload: any | null;
  opcoes: string[] | null;
  anonima: boolean;
  permitir_justificativa: boolean;
  prazo_votacao: string | null;
  quorum_minimo: number | null;
  quorum_atingido: boolean;
  status: "aberta" | "encerrada" | "expirada_sem_quorum";
  decisao: string;
  aplicada_em: string | null;
  resultado: Record<string, number> | null;
  mostra_resultado: boolean;
  meu_voto: string | null;
  total_votos: number;
  total_eleitores: number;
  pendentes: { id: number; nome: string }[];
  expirada: boolean;
  criado_em: string;
}

export type TipoPauta =
  | "alteracao_igreja"
  | "criar_grupo"
  | "criar_sala"
  | "agendar_evento"
  | "enquete_livre"
  | "outra";

export interface Voto {
  id: number;
  pauta: number;
  opcao: OpcaoVoto;
  comentario: string;
  usuario_detalhe: UsuarioMini | null;
  criado_em: string;
}

export interface PautaAnexo {
  id: number;
  arquivo: string | null;
  tipo_mime: string;
  tamanho_bytes: number;
  nome_original: string;
  criado_em: string;
}

export interface PautaComentario {
  id: number;
  pauta: number;
  autor: number;
  autor_detalhe: UsuarioMini;
  texto: string;
  anexos: PautaAnexo[];
  editado: boolean;
  criado_em: string;
  editado_em: string | null;
}

export interface EnqueteOpcao {
  id: number;
  texto: string;
  ordem: number;
  votos: number;
  eu_votei: boolean;
  votantes?: UsuarioMini[];
}

export interface EnqueteGrupo {
  id: number;
  grupo: number;
  pergunta: string;
  multipla_escolha: boolean;
  anonima: boolean;
  prazo: string | null;
  encerrada: boolean;
  encerrada_em: string | null;
  criado_em: string;
  criada_por: number;
  criada_por_detalhe: UsuarioMini;
  opcoes: EnqueteOpcao[];
  total_votos: number;
  meu_voto: number[];
}

export interface Mensagem {
  id: number;
  grupo: number;
  autor: number;
  autor_detalhe: UsuarioMini;
  conteudo: string;
  anexo: string | null;
  enquete: number | null;
  enquete_detalhe: EnqueteGrupo | null;
  criado_em: string;
}

export interface Notificacao {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string;
  lida: boolean;
  criado_em: string;
}

export interface AtividadeLog {
  id: number;
  usuario_detalhe: { nome: string } | null;
  acao: string;
  entidade: string;
  entidade_id: number | null;
  criado_em: string;
}

export interface Dashboard {
  eventos_minha_igreja: Evento[];
  eventos_proximos: Evento[];
  pendencias: { eventos: number; membros: number; pautas_abertas: number };
  pautas_aguardando: Pauta[];
  atividade_recente: AtividadeLog[];
  pode_ver_auditoria: boolean;
  sou_lideranca: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
