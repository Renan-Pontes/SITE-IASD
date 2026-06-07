# Permissões (RBAC) — IASD Gestão

A autorização acontece em **três camadas**, combinadas. A lógica fica centralizada
em [`backend/API/roles.py`](../backend/API/roles.py) e
[`permissions.py`](../backend/API/permissions.py).

## Camadas

1. **Global** — `Profile.is_super_admin` (o Mestre). Pode tudo.
2. **Por igreja** — `Membro.papel` define a liderança local.
   "Liderança da igreja" = ancião, pastor ou administrador da igreja, com `status=ativo`.
3. **Por grupo** — `GrupoMembro.cargo`. "Liderança do grupo" = líder ou diretor.
   A liderança da igreja dona também administra os grupos dela.

## Papéis e o que cada um pode

| Papel | Pode |
|-------|------|
| **super_admin** (Mestre) | Tudo. Cria/edita/exclui igrejas, promove administradores, vê auditoria. |
| **admin_igreja** | Gerencia uma igreja: dados, salas, grupos, membros (aprovar/papéis), aprovar eventos, pautas. |
| **ancião / pastor** | Aprovar eventos da igreja, criar/votar/encerrar pautas, aprovar membros, definir papéis. |
| **líder/diretor de grupo** | Gerencia o grupo: aprovar membros, definir cargos, criar eventos do grupo, chat. |
| **membro da igreja** | Vê a programação, confirma presença, **propõe eventos** (vão para aprovação), pede entrada em grupos. |
| **membro de grupo** | Tudo de membro + chat do grupo + eventos privados do grupo. |
| **visitante** | Vê a programação pública e pode pedir entrada numa igreja. |

## Regras-chave por recurso

| Ação | Quem pode |
|------|-----------|
| Criar igreja | super_admin |
| Editar igreja | liderança daquela igreja / super_admin |
| Excluir igreja | super_admin |
| Entrar numa igreja | qualquer usuário logado (vira `Membro` **pendente**) |
| Aprovar/rejeitar membro · definir papel | liderança da igreja |
| Criar grupo · sala | liderança da igreja |
| Editar grupo | líder/diretor do grupo ou liderança da igreja |
| Entrar num grupo | usuário logado (vira `GrupoMembro` **pendente**) |
| Aprovar membro de grupo · definir cargo | líder/diretor do grupo ou liderança da igreja |
| Ver/postar no chat do grupo | membros ativos do grupo (e liderança) |
| Criar evento | membro ativo da igreja → **pendente**; liderança → **aprovado direto** |
| Aprovar/rejeitar/cancelar evento | liderança da igreja (cancelar: também o criador) |
| Editar/excluir evento | criador ou liderança da igreja |
| Confirmar presença (RSVP) | qualquer usuário logado |
| Ver evento | público aprovado: todos · privado: membros do grupo · pendente/rascunho: criador + liderança |
| Criar/editar pauta · votar · encerrar | **somente liderança da igreja** (anciões) |
| Ver votos (com autor) | liderança da igreja — autor oculto se a pauta for anônima |
| Ver auditoria | super_admin |

## Visibilidade de eventos (resumo do `get_queryset`)

- **Anônimo / visitante:** só eventos **aprovados e públicos**.
- **Usuário logado:** os públicos + os que criou + os **privados de grupos** onde é
  membro ativo + (se for liderança) **tudo das igrejas que lidera** (inclui pendentes).
- **super_admin:** tudo.
