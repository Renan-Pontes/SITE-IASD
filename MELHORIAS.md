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
- ✅ **Confirmar senha + força + mostrar/ocultar** no cadastro e na troca de senha.
- ✅ **Foto no evento**: upload no formulário (preview + validação <5 MB), banner
  no detalhe e thumbnail no card; validação Pillow no backend.
- ✅ **Feedback de pendências** ponta a ponta: card "Suas solicitações pendentes"
  (Dashboard + Perfil), banners de pendente/rejeitado nas telas de grupo e igreja,
  notificação ao usuário na rejeição (antes silenciosa) com motivo opcional.
- ✅ Confirmado: é **webapp puro** (sem Capacitor/React Native) — usa APIs do
  browser (Geolocation, ServiceWorker), mobile-first, PWA.
- ✅ **Layout responsivo desktop**: sidebar persistente em ≥1024px (bottom-nav e
  top-bar somem), conteúdo em coluna confortável, grids de igrejas/grupos, tabela
  de membros densa, tipografia levemente maior — sem alterar a experiência mobile.
- ✅ **ErrorBoundary** (um erro de página não derruba o app).

### Rodada de governança (Canal dos Anciões — completo)
- ✅ **Métodos de votação por pauta**: unanimidade (1 não rejeita na hora),
  maioria simples/absoluta, dois terços, quórum de aprovação, aprovação simples.
  Decisão e fechamento automáticos conforme o método.
- ✅ **Voto neutro** (BUG corrigido): nada pré-selecionado; "alterar meu voto".
- ✅ **Anonimato real**: pauta anônima não mostra contagem parcial durante a
  votação (só participação + pendentes); revela ao encerrar, sem autores.
- ✅ **Enforcement** (BUG): criar grupo/sala vira proposta no Canal (não grava
  direto); aplica automático se aprovada. Edição de igreja por ancião via Canal.
- ✅ **Acompanhamento do proponente**: "Minhas propostas em votação" no dashboard,
  `/api/pautas/minhas/`, notificações de abertura/encerramento/aplicação.
- ✅ **Categorias** de pauta + **página de pautas com 3 abas** (aguardando/andamento/
  histórico) e filtros.
- ✅ **Fórum por pauta**: discussão com Markdown (sanitizado) + anexos (imagens com
  lightbox, documentos com download), editar/excluir, permissões por papel.
- ✅ **Agenda**: modal do dia (RSVP direto + navegação) e visão de semana 7 colunas.
- ✅ **Seguir igreja** (≠ ser membro) + calendário consolidado curado (membro +
  seguidas + próximas) + programação pública visível a qualquer um.
- ✅ **Cores bicolores** do evento (centro = igreja, anel = grupo) + color pickers.
- ✅ **Atalhos de teclado** (/ buscar, ? ajuda, Esc fecha) + FAB/descoberta redundante.
- ✅ **Agenda**: modal do dia (eventos completos + RSVP direto + navegação) e
  visão de semana redesenhada (7 colunas responsivas, cor por grupo, hoje em verde).
- ✅ **Canal dos Anciões**: propostas (alterar igreja / criar grupo / criar sala /
  agendar evento) que viram pauta e **aplicam-se automaticamente** se aprovadas;
  **enquetes livres** com opções custom; justificativa no voto; timeline; card
  "pautas aguardando seu voto" no dashboard. Edição de dados da igreja por ancião
  passa pelo Canal (admin edita direto).
- ✅ **Deploy preparado**: Vercel (frontend) + PythonAnywhere (backend), WhiteNoise,
  `.env` via dotenv, healthcheck `/api/health/`, `vercel.json` (SPA). Veja `docs/DEPLOY.md`.

### Rodada de governança avançada + operação
- ✅ **Conflito de sala**: bloqueio de eventos sobrepostos + endpoint de
  disponibilidade com sugestões (próximo horário / salas livres); re-checagem ao
  aplicar a pauta.
- ✅ **Enquetes no chat de grupo**: múltipla escolha, anônima, prazo, barras de
  resultado, encerramento manual/automático — distinto das pautas de governança.
- ✅ **Papel "Líder de igreja"** + **Canal da Liderança** (eleitorado próprio;
  voto dos anciões é consultivo). Vê eventos privados de toda a igreja.
- ✅ **Cargo "Secretaria"** (paralelo ao papel): **atas automáticas** (rascunho por
  pauta encerrada, editar/publicar) + **acesso de sigilo** aos votos anônimos (com
  auditoria).
- ✅ **Modo igreja única** (`MULTI_CHURCH_ENABLED`): cadastro auto-vincula à Vila
  Formosa; UI esconde lista/seguir/trocar; `/api/config/`.
- ✅ **Painel de auditoria** (liderança/secretaria): filtros (data/tipo), export
  CSV, impressão/PDF, card "Atividade recente" no dashboard.
- ✅ **Governança da programação**: evento **público = pauta** dos anciões;
  **privado = aprovação leve** (líder do grupo aprova).
- ✅ **Histórico vs. permissão** (`papel_desde`): autorização ao vivo, sem
  carry-over; líderes só veem o que é posterior à promoção; auditoria de
  concessão/remoção de papel.
- ✅ **Criar evento só para liderança** (líder de grupo/igreja/ancião): botão
  escondido + 403 + `<BotaoCriarEvento/>` + empty-state educativo.
- ✅ **Monitoramento de login + desativação de inativos**: `last_login`, painel de
  usuários (desativar/reativar), comando `desativar_inativos` (`--dias`,
  `--dry-run`), aviso de conta inativa no login + solicitação de reativação.
