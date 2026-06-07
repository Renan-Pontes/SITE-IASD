import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Plus, Church, MapPin, ShieldCheck, ScrollText } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/Toast";
import type { Igreja } from "../lib/types";
import { Botao, Card, Campo, Badge, SkeletonLista, Vazio } from "../ui/components";
import { Modal } from "../ui/Modal";
import { Sentinela } from "../components/Sentinela";
import { useInfinite } from "../hooks/useInfinite";

export default function SuperAdmin() {
  const { ehSuper, carregando } = useAuth();
  const [criar, setCriar] = useState(false);
  const { items: igrejas, hasMore, loading, carregarMais, recarregar } = useInfinite<Igreja>(
    (page) => `/api/igrejas/?todas=1&page=${page}`,
    [],
  );

  if (carregando) return <SkeletonLista n={4} />;
  if (!ehSuper) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
          <ShieldCheck className="text-marca-600" /> Administração geral
        </h1>
      </div>
      <p className="text-sm text-slate-500">
        Área do administrador geral. Crie e gerencie as igrejas do sistema.
      </p>

      <Botao full onClick={() => setCriar(true)}>
        <Plus size={18} /> Nova igreja
      </Botao>

      {loading && igrejas.length === 0 ? (
        <SkeletonLista n={3} />
      ) : igrejas.length === 0 ? (
        <Vazio titulo="Nenhuma igreja" descricao="Crie a primeira igreja do sistema." icone={<Church size={48} />} />
      ) : (
        <>
          <div className="space-y-3">
            {igrejas.map((ig) => (
              <Card key={ig.id} className="flex items-center gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-xl">⛪</div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-slate-800 dark:text-slate-100">{ig.nome}</h3>
                  <p className="flex items-center gap-1 text-sm text-slate-500">
                    <MapPin size={14} /> {ig.cidade}{ig.estado && `/${ig.estado}`} • {ig.total_membros} membros
                  </p>
                </div>
                {!ig.ativo && <Badge cor="vermelho">Inativa</Badge>}
                <Link to={`/admin/igreja/${ig.id}`} className="btn-secondary !px-3 !py-2 text-sm">
                  Gerir
                </Link>
              </Card>
            ))}
          </div>
          <Sentinela onVisivel={carregarMais} ativo={hasMore} carregando={loading} />
        </>
      )}

      <Link to="/auditoria" className="block">
        <Botao variante="ghost" full>
          <ScrollText size={18} /> Ver registro de auditoria
        </Botao>
      </Link>

      <NovaIgreja
        aberto={criar}
        aoFechar={() => setCriar(false)}
        aoCriar={() => {
          setCriar(false);
          recarregar();
        }}
      />
    </div>
  );
}

const VAZIO = {
  nome: "", descricao: "", endereco: "", cidade: "", estado: "", cep: "",
  latitude: "", longitude: "", telefone: "", email: "", anciao_email: "",
};

function NovaIgreja({
  aberto, aoFechar, aoCriar,
}: {
  aberto: boolean; aoFechar: () => void; aoCriar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ ...VAZIO });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  const submeter = async () => {
    if (!form.nome.trim()) {
      toast.erro("Informe o nome da igreja.");
      return;
    }
    setSalvando(true);
    try {
      await api.post("/api/igrejas/", {
        nome: form.nome,
        descricao: form.descricao,
        endereco: form.endereco,
        cidade: form.cidade,
        estado: form.estado,
        cep: form.cep,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        telefone: form.telefone,
        email: form.email,
        anciao_email: form.anciao_email || undefined,
      });
      toast.sucesso("Igreja criada!");
      setForm({ ...VAZIO });
      aoCriar();
    } catch (err) {
      toast.erro(err instanceof ApiError ? err.message : "Erro ao criar a igreja.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Nova igreja"
      rodape={
        <>
          <Botao variante="ghost" full onClick={aoFechar}>Cancelar</Botao>
          <Botao full onClick={submeter} carregando={salvando}>Criar</Botao>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <Campo label="Nome *">
          <input className="input" value={form.nome} onChange={set("nome")} />
        </Campo>
        <Campo label="Descrição">
          <textarea className="input min-h-[60px]" value={form.descricao} onChange={set("descricao")} />
        </Campo>
        <Campo label="Endereço">
          <input className="input" value={form.endereco} onChange={set("endereco")} />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Campo label="Cidade">
              <input className="input" value={form.cidade} onChange={set("cidade")} />
            </Campo>
          </div>
          <Campo label="UF">
            <input className="input" maxLength={2} value={form.estado} onChange={set("estado")} />
          </Campo>
        </div>
        <Campo label="CEP">
          <input className="input" value={form.cep} onChange={set("cep")} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Latitude">
            <input className="input" inputMode="decimal" placeholder="-23.55" value={form.latitude} onChange={set("latitude")} />
          </Campo>
          <Campo label="Longitude">
            <input className="input" inputMode="decimal" placeholder="-46.63" value={form.longitude} onChange={set("longitude")} />
          </Campo>
        </div>
        <p className="-mt-1 text-xs text-slate-400">
          Dica: no Google Maps, clique com o botão direito no local → as coordenadas
          aparecem no topo do menu. Usadas para ordenar por proximidade e no mapa.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Telefone">
            <input className="input" value={form.telefone} onChange={set("telefone")} />
          </Campo>
          <Campo label="E-mail">
            <input className="input" value={form.email} onChange={set("email")} />
          </Campo>
        </div>
        <Campo label="E-mail do ancião responsável (opcional)" dica="Se já tiver conta, vira ancião ativo da igreja.">
          <input className="input" value={form.anciao_email} onChange={set("anciao_email")} placeholder="anciao@email.com" />
        </Campo>
      </div>
    </Modal>
  );
}
