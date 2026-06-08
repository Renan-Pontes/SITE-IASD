# IASD Gestão ✛

Webapp beneficente para **organização e gestão da Igreja Adventista do Sétimo Dia**:
agenda de eventos, gestão de igrejas e grupos, fluxo de aprovação de eventos,
votação de pautas pelos anciões e uma agenda digital para todos os membros.

> Código aberto. Qualquer melhoria é bem-vinda.

---

## ✨ O que dá pra fazer

- **Várias igrejas** cadastradas, com busca e **ordenação por proximidade** (GPS).
- **Membros** entram numa igreja e recebem um **papel** (visitante, membro, ancião,
  pastor, administrador) — com aprovação da liderança.
- **Grupos** (ministérios, classes, desbravadores, música…) com **chat**,
  cargos internos, eventos próprios e pedidos de entrada.
- **Eventos** com **fluxo de aprovação**: membros propõem → anciões aprovam.
  Confirmação de presença ("EU VOU"), eventos públicos/privados e recorrência.
- **Calendário** em **mês / semana / dia**, consolidado e com expansão de
  recorrências (inclui mensal "Nth weekday", ex.: 2ª terça do mês), com filtros.
- **Canal dos Anciões**: propostas de mudança (alterar igreja, criar grupo/sala,
  agendar evento) que viram **pauta de votação** e, se aprovadas, **aplicam-se
  automaticamente**; além de **enquetes livres** com opções customizadas.
- **Pautas** com **votação** (sim/não/abstenção ou opções custom), **voto secreto**,
  **justificativa**, **quórum** com fechamento automático, **timeline** e resultado.
- **Mapa** das igrejas (Leaflet/OSM) e **busca textual global**.
- **Notificações** in-app, **chat de grupo** e **log de auditoria** para governança.
- **PWA instalável**, **upload de fotos**, **exportar evento `.ics`**,
  **modo claro/escuro** e **scroll infinito** nas listas.
- **Acessibilidade pensada para os anciões**: botões grandes, alto contraste,
  modo "fonte grande", português direto.

---

## 🧱 Stack

| Camada    | Tecnologia |
|-----------|------------|
| Backend   | Django 5 + Django REST Framework + SimpleJWT |
| Banco     | SQLite (padrão do Django — dev e produção) |
| Frontend  | Vite + React 18 + TypeScript + Tailwind CSS |
| Auth      | JWT (access + refresh) |
| Deploy    | Frontend → Vercel · Backend → PythonAnywhere |

Documentação detalhada em [`docs/`](docs/):
[Esquema do banco](docs/SCHEMA.md) · [Permissões/RBAC](docs/RBAC.md) ·
[Princípios de UX](docs/UX.md) · [Deploy](docs/DEPLOY.md).

---

## 🚀 Rodando localmente

Pré-requisitos: **Python 3.11+** e **Node 18+**.

### 1. Backend (Django)

```bash
cd backend

# (opcional) ambiente virtual
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate

pip install -r requirements.txt

python manage.py migrate
python manage.py seed_demo          # popula dados de demonstração
python manage.py runserver 8000
```

A API sobe em `http://localhost:8000/api/` e o admin em `http://localhost:8000/admin/`.

### 2. Frontend (Vite)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra **http://localhost:5173**. O Vite faz proxy de `/api` para o Django
(sem dor de cabeça com CORS).

---

## 🔑 Contas de demonstração

Criadas pelo `seed_demo`:

| Conta                | Senha           | Papel |
|----------------------|-----------------|-------|
| `renan@iasd.app`     | `MestreIASD@2026` | **Administrador geral** (super admin) |
| `anciao@iasd.app`    | `iasd1234`      | Ancião (Central + Hortolândia) |
| `pastor@iasd.app`    | `iasd1234`      | Pastor (Central) |
| `lider@iasd.app`     | `iasd1234`      | Líder/Diretor de grupo |
| `membro@iasd.app`    | `iasd1234`      | Membro |
| `visitante@iasd.app` | `iasd1234`      | Visitante (entrada pendente) |

> ⚠️ **Todas as personas de demonstração usam a senha `iasd1234`.** Rodar
> `python manage.py seed_demo` de novo é idempotente, mas **não** redefine
> senhas já existentes. Para resetar **todas** as contas para `iasd1234`:
>
> ```bash
> python manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); [ (u.set_password('iasd1234'), u.save()) for u in U.objects.all() ]"
> ```
>
> ⚠️ Troque a senha do Mestre (`renan@iasd.app`) antes de qualquer uso real.

---

## 🚀 Deploy (Vercel + PythonAnywhere)

O código já está preparado para deploy:

- **Frontend → Vercel** (auto-deploy via GitHub, com rewrite de SPA).
- **Backend → PythonAnywhere** (SQLite, WhiteNoise para estáticos, `.env` via
  `python-dotenv`, healthcheck em `/api/health/`).

Passo a passo completo (env vars, `collectstatic`, mapeamento de `/media/`,
configuração do Web tab) em **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

> O banco é **SQLite** (padrão do Django) tanto em dev quanto em produção —
> sem servidor de banco para configurar.

---

## 🧪 Testes

```bash
cd backend
python manage.py test          # 14 testes dos fluxos críticos
```

```bash
cd frontend
npm run build                  # typecheck + build de produção
```

### Tarefas de manutenção (agendar em produção)

```bash
python manage.py fechar_pautas       # encerra pautas com prazo/quórum atingido
python manage.py purgar_auditoria    # remove auditoria > 90 dias (--dias N)
```

---

## 📂 Estrutura

```
backend/          Django + DRF
  API/            models, serializers, views (DRF), roles/permissions, seed, testes
  backend/        settings, urls
frontend/         Vite + React + TS + Tailwind
  src/pages/      telas
  src/components/ layout, calendário, card de evento
  src/ui/         botões, toasts, modais, skeletons
  src/api/        cliente HTTP com JWT
docs/             SCHEMA, RBAC, UX
MELHORIAS.md      próximos passos / backlog
```
