# Deploy — IASD Gestão

Arquitetura de produção (mesmo padrão do projeto Núcleo):

- **Frontend (React/Vite) → Vercel** (auto-deploy via GitHub).
- **Backend (Django) → PythonAnywhere** (free tier, SQLite, conta `Renan@request.coffee`).

O código já está preparado. Quando for deployar, siga os passos abaixo.

---

## 1. Backend no PythonAnywhere

### 1.1. Subir o código
No console Bash do PythonAnywhere:

```bash
git clone https://github.com/<seu-usuario>/SITE-IASD.git
cd SITE-IASD/backend
pip install --user -r requirements.txt
```

### 1.2. Criar o `.env`
Crie `SITE-IASD/backend/.env` (veja `backend/.env.example`):

```ini
DJANGO_SECRET_KEY=<gere uma nova: python -c "import secrets;print(secrets.token_urlsafe(50))">
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=SEU_USUARIO.pythonanywhere.com
CORS_ALLOWED_ORIGINS=https://SEU-APP.vercel.app
CSRF_TRUSTED_ORIGINS=https://SEU-APP.vercel.app
CORS_ALLOW_ALL_ORIGINS=false
```

### 1.3. Migrar, semear e coletar estáticos
```bash
python manage.py migrate
python manage.py seed_demo        # opcional (dados de demonstração)
python manage.py collectstatic --noinput
```

### 1.4. Configurar o Web tab
Na aba **Web** do PythonAnywhere:

1. **Add a new web app** → **Manual configuration** → Python 3.11.
2. **Source code:** `/home/SEU_USUARIO/SITE-IASD/backend`
3. **WSGI configuration file:** edite e aponte para o WSGI do projeto. O modo
   mais simples é substituir o conteúdo pelo de `backend/backend/wsgi.py`
   (ele já carrega o `.env` via `python-dotenv` e define o settings module).
   Garanta que o `path` do projeto está no `sys.path`:
   ```python
   import sys
   path = "/home/SEU_USUARIO/SITE-IASD/backend"
   if path not in sys.path:
       sys.path.insert(0, path)
   ```
4. **Static files** (mapeamentos):
   | URL | Directory |
   |-----|-----------|
   | `/static/` | `/home/SEU_USUARIO/SITE-IASD/backend/staticfiles` |
   | `/media/`  | `/home/SEU_USUARIO/SITE-IASD/backend/media` |

   > O `/media/` é **essencial** para as fotos enviadas (perfil, igreja, grupo,
   > evento) aparecerem. O WhiteNoise cuida do `/static/`, mas o mapeamento
   > acima também funciona e é o recomendado pelo PythonAnywhere.

5. **Reload** o web app.

Teste: `https://SEU_USUARIO.pythonanywhere.com/api/health/` deve responder
`{"status": "ok"}`.

> **Banco:** é SQLite (`backend/db.sqlite3`), padrão do Django — sem servidor de
> banco. Para resetar dados, basta migrar/semear de novo.

---

## 2. Frontend no Vercel

### 2.1. Antes de subir — apontar para o backend
Edite **uma linha** em `frontend/src/api/client.ts`:

```ts
const API_PROD = "https://SEU-USUARIO.pythonanywhere.com";
```

(Em produção o app usa essa URL automaticamente; em dev usa o proxy do Vite.
Não precisa configurar env var no Vercel.)

### 2.2. Conectar no Vercel
1. **Import Project** → selecione o repositório no GitHub.
2. **Root Directory:** `frontend`
3. Framework: **Vite** (detectado). Build: `npm run build`. Output: `dist`.
4. **Deploy.**

O `frontend/vercel.json` já faz o **rewrite de SPA** (`/* → /index.html`),
então atualizar uma rota interna (ex.: `/agenda`) não dá 404.

Cada `git push` na branch principal redeploya automaticamente.

---

## 3. Checklist pós-deploy

- [ ] `GET /api/health/` responde `ok` no PythonAnywhere.
- [ ] `DJANGO_DEBUG=false` no `.env` de produção.
- [ ] `DJANGO_ALLOWED_HOSTS` tem o domínio do PythonAnywhere.
- [ ] `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` têm o domínio do Vercel.
- [ ] `API_PROD` no `client.ts` aponta para o PythonAnywhere.
- [ ] `collectstatic` rodado e mapeamentos `/static/` e `/media/` configurados.
- [ ] Trocar a senha da conta `renan@iasd.app`.
