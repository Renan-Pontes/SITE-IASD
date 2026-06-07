# Melhorias — backlog

Estado: **MVP + várias evoluções entregues**. Backend DRF + frontend React, todos
os fluxos principais jogáveis. Lista do que ainda dá pra evoluir.

## ⏳ Pendente

### Depende de e-mail/SMTP (adiado pelo Mestre)
- [ ] **"Esqueci minha senha"** por e-mail.
- [ ] **Notificações por e-mail** opcionais (campo `notificacoes_email` já existe):
      novo pedido de entrada, evento aprovado, nova pauta.

### Funcionalidades
- [ ] **Mural de grupo** (postagens com curtir/comentar) — hoje o grupo tem chat.
- [ ] **Convites por link** (token único para entrar direto num grupo/igreja).
- [ ] **Histórico de presença** do usuário (eventos a que já foi / relatório de check-ins).
- [ ] **Relatórios** para a liderança (presença média, crescimento de membros).
- [ ] **Feed iCal assinável** (subscription) com a agenda inteira por usuário
      (hoje exporta evento por evento via `.ics`).
- [ ] **Chat em tempo real** de verdade (WebSockets) — só viável em infra que suporte
      conexões persistentes (PythonAnywhere free tier não suporta; hoje é polling
      incremental a cada 4s, ciente de foco).

### Qualidade / segurança
- [ ] **Testes de frontend** (smoke com Vitest/Playwright: login → agenda → RSVP).
- [ ] **i18n** de verdade — extrair strings (estrutura pronta, tudo em pt-BR hoje).
- [ ] **Rate limiting** e captcha no cadastro/login.
- [ ] **Lixeira / restaurar** itens arquivados (hoje arquivar grupo/sala só marca
      `ativo=false`, sem tela de restauração).

## 🔧 Dívidas técnicas / observações
- `LIMITE_OCORRENCIAS` do calendário é 60 por evento (proteção); recorrências muito
  longas são truncadas silenciosamente — considerar paginar a agenda por período.
- O mapa carrega até ~20 igrejas (primeiras páginas); paginar/clusterizar se crescer.
- Definir periodicidade das tarefas agendadas em produção:
  `python manage.py fechar_pautas` e `python manage.py purgar_auditoria`.
- Em produção: rodar `collectstatic`, `DJANGO_DEBUG=false`, mídia por storage
  dedicado se o volume crescer.

---

## ✅ Concluído

### MVP base
- ✅ Auth JWT (registro/login/refresh/me/trocar-senha).
- ✅ Igrejas, Membros (papéis/aprovação), Grupos, GrupoMembros (cargos), Salas.
- ✅ Eventos com workflow de aprovação + RSVP "EU VOU" + recorrência.
- ✅ Pautas + votação (com voto secreto) — espaço dos anciões.
- ✅ Chat de grupo, notificações in-app, log de auditoria.
- ✅ RBAC em 3 níveis (super_admin / liderança de igreja / liderança de grupo).
- ✅ Acessibilidade pros anciões (botões grandes, contraste, fonte grande, confirmações).
- ✅ Dashboard com pendências da liderança; admin da igreja.

### Evoluções
- ✅ Ordenação de igrejas por **proximidade (GPS/Haversine)**.
- ✅ **Calendário consolidado** com expansão de recorrências, incluindo
  **mensal "Nth weekday"** (ex.: 2ª terça, último domingo).
- ✅ **Calendário em mês / semana / dia**.
- ✅ **PWA instalável** (manifest + ícones + service worker).
- ✅ **Upload de fotos** (perfil, igreja, grupo, evento).
- ✅ **Exportar evento `.ics`** (Google Agenda / calendário do celular).
- ✅ **Paginação / scroll infinito** nas listas grandes.
- ✅ **Página super admin** (criar/gerir igrejas pela UI) + **auditoria** na UI.
- ✅ **Mapa** das igrejas com pinos (Leaflet + OpenStreetMap).
- ✅ **Quórum** de pauta + **fechamento automático** (signal + comando p/ prazo).
- ✅ **Busca textual global** (igrejas, grupos, eventos, pessoas).
- ✅ **Filtros na agenda** (igreja / grupo).
- ✅ **Editar / arquivar** grupos e salas pela UI.
- ✅ **Chat com polling incremental** (mais leve e ágil; pausa com a aba oculta).
- ✅ **Retenção de auditoria** (comando de purga, padrão 90 dias).
- ✅ **Modo claro / escuro** (respeita o sistema, persiste, tema verde preservado).
- ✅ **Deploy preparado**: Vercel (frontend) + PythonAnywhere (backend), WhiteNoise,
  `.env` via dotenv, healthcheck `/api/health/`, `vercel.json` (SPA). Veja `docs/DEPLOY.md`.
