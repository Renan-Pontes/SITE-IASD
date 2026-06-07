# Melhorias — backlog priorizado

Estado: **MVP funcional** (backend DRF + frontend React, fluxos principais jogáveis).
Lista do que evoluir a seguir. Marcados com ✅ o que já caiu como melhoria nesta noite.

## 🔝 Prioridade alta (próximos passos)

- [ ] **Upload de fotos** (perfil, igreja, grupo, evento). Backend já tem os campos
      `ImageField`; falta o endpoint multipart e o seletor de arquivo no front.
- [ ] **PWA / instalável** — manifest + service worker para instalar como app no
      celular e funcionar offline-first (cache da agenda).
- [ ] **"Esqueci minha senha"** por e-mail (hoje só há troca de senha logado).
      Precisa configurar envio de e-mail (SMTP) no Django.
- [ ] **Notificações por e-mail** opcionais (campo `notificacoes_email` já existe):
      novo pedido de entrada, evento aprovado, nova pauta.
- [ ] **Paginação/scroll infinito** nas listas grandes do front (a API já pagina;
      o front hoje só lê a 1ª página em alguns lugares).

## 🟡 Prioridade média

- [ ] **Mapa com pinos** das igrejas próximas (Leaflet/OpenStreetMap, sem chave paga).
- [ ] **Exportar agenda** para Google Calendar / iCal (`.ics`) — gerar feed por usuário.
- [ ] **Chat em tempo real** com WebSockets (Django Channels + Redis). Hoje é polling
      a cada 8s — funciona, mas não é instantâneo.
- [ ] **Modo claro/escuro** (a base de cores já está centralizada).
- [ ] **Editar grupo/sala** pela UI (criar já existe; falta editar/desativar).
- [ ] **Quórum / fechamento automático de pauta** quando todos os anciões votarem
      ou o prazo expirar (hoje o `expirada` é só informativo).
- [ ] **Filtros na agenda** por igreja/grupo/tipo direto no calendário.
- [ ] **Busca textual global** (eventos, grupos, igrejas).

## 🟢 Prioridade baixa / refinamentos

- [ ] **i18n** de verdade — extrair strings (estrutura pronta, tudo em pt-BR hoje).
- [ ] **Página do super admin** dedicada (criar igrejas pela UI, ver auditoria,
      promover admins) — hoje isso é feito pelo Django Admin.
- [ ] **Reações/curtidas e comentários** no chat e em postagens de grupo.
- [ ] **Relatórios** para a liderança (presença média, crescimento de membros).
- [ ] **Histórico de presença** do usuário (eventos a que já foi).
- [ ] **Convites** por link para entrar direto num grupo/igreja.
- [ ] **Testes de frontend** (smoke com Vitest/Playwright: login → agenda → RSVP).
- [ ] **Rate limiting** e captcha no cadastro/login (segurança).
- [ ] **Soft-delete** explícito + lixeira para eventos/grupos.

## 🔧 Dívidas técnicas / observações

- O front lê só a 1ª página em listas que usam `Paginated` — revisar para carregar tudo
  ou paginar de verdade quando o volume crescer.
- `recorrencia_ate` mensal usa passo fixo de 30 dias (aproximação). Para datas exatas
  (ex.: "toda 1ª terça"), usar `dateutil.rrule` no futuro.
- Em produção: rodar `collectstatic`, servir mídia por storage dedicado (S3/Cloud),
  usar Gunicorn/Uvicorn + Nginx e `DJANGO_DEBUG=false`.
- Definir política de retenção do `AuditLog` (cresce indefinidamente).

---

### ✅ Já implementado nesta noite (além do MVP base)

- ✅ Ordenação de igrejas por **proximidade (GPS)** com Haversine no servidor.
- ✅ **Calendário consolidado** que expande **eventos recorrentes**.
- ✅ **Voto secreto** em pautas (oculta o autor de ponta a ponta).
- ✅ **Modo "fonte grande"** persistido para acessibilidade dos anciões.
- ✅ **Notificações in-app** com contador de não lidas.
- ✅ **Log de auditoria** para governança.
- ✅ **Dashboard** com pendências da liderança em destaque.
