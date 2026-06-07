# Esquema do banco — IASD Gestão

Modelado para MySQL (utf8mb4), com índices compostos nas consultas quentes.
Todas as tabelas vivem no app `API`.

## Diagrama (entidades e relações)

```
User (Django)
  └─1:1─ Profile (telefone, foto, bio, igreja_principal→Igreja,
                  lat/lng, is_super_admin, fonte_grande, notificacoes_email)

Igreja (nome, slug, descrição, endereço, cidade, estado, cep,
        lat/lng, telefone, email, foto, ativo)
  ├─1:N─ Membro       (User × Igreja)  papel, status, aprovado_por
  ├─1:N─ Grupo        (nome, slug, tipo, descrição, foto, ativo)
  │        └─1:N─ GrupoMembro (User × Grupo) cargo, status
  │        └─1:N─ Mensagem     (chat: autor→User, conteúdo, anexo)
  ├─1:N─ Sala         (nome, capacidade, equipamentos, ativo)
  ├─1:N─ Evento       (título, descrição, início, fim, visibilidade,
  │        │           status, recorrência, foto, criado_por, aprovado_por)
  │        ├─FK opt─ Grupo
  │        ├─FK opt─ Sala
  │        └─1:N─ Inscricao   (User × Evento)  status (RSVP)
  └─1:N─ Pauta        (título, descrição, anonima, prazo_votacao, status)
           └─1:N─ Voto         (User × Pauta)  opcao, comentario

Notificacao (User, tipo, título, mensagem, link, lida)
AuditLog    (User, acao, entidade, entidade_id, detalhes JSON)
```

## Enums principais

| Campo | Valores |
|-------|---------|
| `Membro.papel` | visitante, membro, anciao, pastor, admin_igreja |
| `Membro.status` / `GrupoMembro.status` | pendente, ativo, rejeitado, inativo |
| `Grupo.tipo` | ministerio, classe, desbravadores, aventureiros, musica, jovens, outro |
| `GrupoMembro.cargo` | membro, secretario, lider, diretor |
| `Evento.visibilidade` | publico, privado |
| `Evento.status` | rascunho, pendente, aprovado, rejeitado, cancelado |
| `Evento.recorrencia` | nenhuma, diaria, semanal, mensal |
| `Inscricao.status` | confirmado, talvez, cancelado |
| `Pauta.status` | aberta, encerrada |
| `Voto.opcao` | sim, nao, abstencao |

## Índices e restrições (otimização MySQL)

| Tabela | Índice / restrição | Para quê |
|--------|--------------------|----------|
| Igreja | `(cidade, estado)`, `ativo`; `slug` único | busca/filtragem de igrejas |
| Membro | `(igreja, status)`, `(igreja, papel)`, `(usuario, status)`; **único** `(usuario, igreja)` | caixa de aprovação, papéis, evita duplicidade |
| Grupo | `(igreja, ativo)`, `(igreja, tipo)`; **único** `(igreja, slug)` | grupos por igreja |
| GrupoMembro | `(grupo, status)`, `(usuario, status)`; **único** `(usuario, grupo)` | membros/pendências do grupo |
| Sala | `(igreja, ativo)` | salas ativas |
| Evento | `(igreja, status, inicio)`, `(grupo, inicio)`, `(status, inicio)`, `(visibilidade, status)` | agenda da igreja e do grupo |
| Inscricao | `(evento, status)`, `(usuario, status)`; **único** `(usuario, evento)` | confirmados, "minhas inscrições" |
| Pauta | `(igreja, status, -criado_em)` | lista de pautas da igreja |
| Voto | `(pauta, opcao)`; **único** `(pauta, usuario)` | apuração, um voto por pessoa |
| Mensagem | `(grupo, criado_em)` | histórico do chat |
| Notificacao | `(usuario, lida, -criado_em)` | não lidas do usuário |
| AuditLog | `(entidade, entidade_id)`, `(-criado_em)` | rastreabilidade |

## Notas

- **Soft-delete leve** via flag `ativo` em Igreja, Grupo e Sala (preserva histórico).
- **Geolocalização** em `DecimalField(9,6)`; a distância é calculada por Haversine
  no servidor e devolvida como `distancia_km`.
- **Recorrência** é guardada no evento base; o endpoint `/api/calendario/` expande
  as ocorrências dentro da janela pedida (limite de 60 por evento).
