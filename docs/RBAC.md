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
| **líder de igreja** | Nível entre membro e ancião. Tem o **Canal da Liderança** (cria pautas/enquetes com método próprio) e vê **eventos privados de qualquer grupo** da igreja. **Não** gere a programação (não aprova eventos nem cria grupos/salas). |
| **líder/diretor de grupo** | Gerencia o grupo: aprovar membros, definir cargos, criar eventos do grupo, chat. (Cargo interno do grupo — ≠ líder de igreja.) |
| **secretaria** (cargo paralelo) | Boolean independente do papel. Registra **atas**, e tem **acesso de sigilo** aos votos de pautas anônimas (cada acesso é auditado). Não substitui o papel — soma a ele. |
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
| **Quem pode criar evento** | só **líder de grupo**, **líder de igreja** ou **ancião** (membro comum/visitante: botão escondido + 403) |
| Criar evento **público** | vira **pauta** no Canal dos Anciões (ancião cria direto) |
| Criar evento **privado** | **pendente** → líder do grupo / liderança aprova (ancião: direto) |
| Aprovar/rejeitar/cancelar evento | liderança da igreja, ou líder do grupo (privados); cancelar: também o criador |
| Ver auditoria | super, liderança ou secretaria (filtros + export CSV) |
| Editar/excluir evento | criador ou liderança da igreja |
| Confirmar presença (RSVP) | qualquer usuário logado |
| Ver evento | público aprovado: todos · privado: membros do grupo · pendente/rascunho: criador + liderança |
| Criar/editar pauta · votar · encerrar (Canal dos Anciões) | liderança da igreja (anciões) |
| Criar/editar/votar/encerrar pauta (Canal da Liderança) | líderes de igreja; anciões votam de forma **consultiva** (não conta p/ quórum) |
| Ver votos (com autor) | eleitorado do canal + proponente — autor oculto se anônima (secretaria revela, sob auditoria) |

## Canais de pauta (`Pauta.canal`)

| Canal | Eleitorado (quórum) | Quem abre | Escopo |
|-------|---------------------|-----------|--------|
| `anciaos` (Canal dos Anciões) | anciões/pastores/admins | qualquer membro propõe | governança: aplica mudanças (grupo/sala/igreja/evento) |
| `lideranca` (Canal da Liderança) | líderes de igreja | líder de igreja (ou ancião) | deliberação/enquete; **não** gere a programação |

No Canal da Liderança os anciões podem votar, mas o voto é **consultivo**:
`Pauta.votos_que_contam()` exclui votos de fora do eleitorado do canal.

## Histórico vs. permissão (sem carry-over)

A autorização é **sempre ao vivo** (cada request checa o papel atual). Não há
herança do passado:

- **Anciões / secretaria / admin:** veem **todo o histórico** e perdem o acesso
  **imediatamente** ao serem rebaixados (403/404 nos endpoints sensíveis).
- **Líder de igreja:** só enxerga o que foi criado **a partir do seu
  `papel_desde`** — pautas do Canal da Liderança e eventos privados anteriores
  à promoção **não aparecem**. `Membro.papel_desde` é reiniciado a cada troca de
  papel (`definir_papel`).
- **Auditoria:** trocas de papel geram `papel_concedido` / `papel_removido`
  (com `{de, para}`).

## Visibilidade de eventos (resumo do `get_queryset`)

- **Anônimo / visitante:** só eventos **aprovados e públicos**.
- **Usuário logado:** os públicos + os que criou + os **privados de grupos** onde é
  membro ativo + (se for liderança) **tudo das igrejas que lidera** (inclui pendentes).
- **líder de igreja:** além do acima, vê **eventos privados de qualquer grupo** da
  sua igreja (aprovados).
- **super_admin:** tudo.
