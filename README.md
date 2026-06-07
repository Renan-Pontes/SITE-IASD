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
- **Calendário** mensal consolidado (eventos de todas as suas igrejas e grupos).
- **Pautas** dos anciões com **votação** (sim/não/abstenção), **voto secreto**
  opcional e resultado em tempo real.
- **Notificações** in-app e **log de auditoria** para governança.
- **Acessibilidade pensada para os anciões**: botões grandes, alto contraste,
  modo "fonte grande", português direto.

---

## 🧱 Stack

| Camada    | Tecnologia |
|-----------|------------|
| Backend   | Django 5 + Django REST Framework + SimpleJWT |
| Banco     | SQLite (dev) · MySQL (produção, via `PyMySQL`) |
| Frontend  | Vite + React 18 + TypeScript + Tailwind CSS |
| Auth      | JWT (access + refresh) |

Documentação detalhada em [`docs/`](docs/):
[Esquema do banco](docs/SCHEMA.md) · [Permissões/RBAC](docs/RBAC.md) ·
[Princípios de UX](docs/UX.md).

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

> ⚠️ Troque a senha do Mestre antes de qualquer uso real.

---

## 🐬 Usando MySQL (produção)

Crie o banco e configure o `.env` (veja [`backend/.env.example`](backend/.env.example)):

```bash
DB_ENGINE=mysql
DB_NAME=iasd
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_HOST=127.0.0.1
DB_PORT=3306
```

```sql
CREATE DATABASE iasd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Depois rode `python manage.py migrate`. O projeto já usa `utf8mb4` e índices
compostos pensados para MySQL.

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
