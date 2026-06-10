# Governança — Canal dos Anciões

Regra de ouro do projeto (pedido do Mestre): **o que afeta a igreja toda não é
criado direto — passa pela votação dos anciões.**

## Dois regimes de decisão

### 1. Aprovação simples (1 aprovador basta)
Ações de escopo restrito, decididas por um único líder/ancião/admin:
- **Entrar numa igreja** (pedido → um líder aprova)
- **Entrar num grupo** (pedido → líder/diretor do grupo aprova)
- **Confirmar presença (RSVP)** num evento
- **Aprovar/rejeitar membro** de igreja ou grupo
- **Foto** da igreja/grupo/evento (cosmético) e **chat** de grupo
- **Editar o próprio perfil**

### 2. Votação (Canal dos Anciões, com método declarado)
Ações que **afetam a igreja como um todo** viram **Pauta** e só se concretizam se
aprovadas:
- **Criar grupo** → `POST /api/grupos/` devolve `202 {status: "pauta_aberta", pauta_id}`
- **Criar sala/local** → `POST /api/salas/` idem
- **Alterar dados da igreja** → ancião propõe pelo Canal (`alteracao_igreja`)
- **Agendar evento** que afeta a igreja → proposta `agendar_evento` no Canal

Quando a pauta encerra **aprovada**, o sistema **aplica o payload automaticamente**
(cria o grupo/sala, edita a igreja, agenda o evento) e marca `aplicada_em`.

> **Eventos do dia a dia** (de um grupo) seguem o fluxo mais leve de aprovação:
> membro propõe → fica `pendente` → um ancião aprova. Para programação que afeta a
> igreja inteira, use o Canal (votação completa).

## Canais (`Pauta.canal`)

- **Canal dos Anciões** (`anciaos`, padrão): governança da igreja. Eleitorado =
  anciões/pastores/admins. Pautas aprovadas **aplicam-se** (criar grupo/sala,
  alterar igreja, agendar evento).
- **Canal da Liderança** (`lideranca`): espaço dos **líderes de igreja** (papel
  entre membro e ancião) para deliberar e consultar. Eleitorado = líderes de
  igreja. Anciões podem votar, mas o voto é **consultivo** (não conta para o
  quórum). Não aplica mudanças na programação — só deliberação/enquete.

## Métodos de votação (`Pauta.metodo_votacao`)

| Método | Como decide | Fecha cedo? |
|--------|-------------|-------------|
| `unanimidade` | Todos os anciões precisam aprovar | **Sim** — 1 "não" rejeita na hora |
| `maioria_simples` | Mais "sim" que "não" | Não (aguarda todos/prazo) |
| `maioria_absoluta` | "sim" > 50% do total de anciões | **Sim** — ao cruzar 50% |
| `dois_tercos` | "sim" ≥ 2/3 dos votos válidos | Não |
| `quorum_aprovacao` | "sim" ≥ `quorum_minimo` | **Sim** — ao atingir |
| `lider` | 1 "sim" basta (casos simples) | **Sim** |

- O **quórum** (`quorum_minimo`) é um *gate de validade*: se o prazo expira sem
  atingi-lo, a pauta vira `expirada_sem_quorum` (o proponente pode reenviar).
- O **proponente escolhe o método** ao criar a pauta.

## Voto

- O voto **começa neutro** — nada pré-selecionado. O ancião precisa **clicar
  conscientemente** em Sim/Não/Abstenção. Pode **alterar** o voto antes do
  encerramento.
- **Justificativa** opcional por voto (se a pauta permitir).

## Anonimato

Em pauta **anônima**, durante a votação:
- ✅ Mostra **participação** ("5 de 8 anciões votaram") e **quem ainda não votou**.
- ❌ **Não** mostra contagem por opção nem quem votou em quê.
- Banner: *"Esta votação é anônima. Os votos serão revelados após o encerramento."*

Ao **encerrar**: revela contagem por opção + justificativas (sem autor). **Quem
votou em quê nunca é revelado.** Em `unanimidade` anônima, um "não" encerra
imediatamente como rejeitado, **sem revelar o autor**.

## Acompanhamento pelo proponente

Quem propõe (mesmo não sendo ancião) acompanha a própria pauta:
- `GET /api/pautas/minhas/` — lista as suas propostas
- Vê **status, participação e prazo** (respeitando o anonimato: só participação
  durante a votação anônima).
- É **notificado** quando a pauta abre, encerra e é aplicada.

## Fórum de discussão (por pauta)

Cada pauta tem uma aba **Discussão** (estilo fórum, não chat realtime) para tirar
dúvidas e anexar documentos **antes/durante** o voto:
- **Quem comenta/anexa:** anciões da igreja + o proponente + admins. Membros comuns
  não comentam (a governança é dos anciões).
- **Markdown** sanitizado (sem HTML cru); links abrem em nova aba.
- **Anexos:** jpg/png/gif/webp/pdf/docx/xlsx/txt/md, até 10 MB, 5 por comentário.
  Imagens viram preview (lightbox); documentos viram download.
- O autor pode **editar** (marca "(editado)") e **excluir** (soft-delete) o próprio
  comentário; admin também pode excluir.
- **Anonimato:** apenas o **voto** é anônimo. Os comentários do fórum **sempre
  mostram o autor** (transparência da discussão).
- Atualização **manual** (botão "Atualizar") — sem WebSocket. Novo comentário
  notifica os anciões e o proponente.

## Enquetes de grupo (≠ pautas)

O chat de cada grupo tem **enquetes informais** — não confundir com as pautas de
governança dos anciões:

| | Enquete de grupo | Pauta (Canal dos Anciões) |
|---|---|---|
| Quem cria | Qualquer **membro ativo** do grupo | Liderança / proponente |
| Quem vota | **Todos** os membros do grupo | Apenas anciões |
| Resultado | **Barras visíveis sempre** durante a votação | Oculto se anônima e aberta |
| `anônima` | Esconde só **quem** votou (contagem aparece) | Esconde contagem e autor |
| Efeito | Nenhum (consulta de opinião) | Se aprovada, **aplica** mudança |
| Encerramento | Autor/líder do grupo, ou por **prazo** | Método declarado + quórum/prazo |

Suporta **múltipla escolha** e **prazo** (fechamento automático via
`fechar_pautas`). Aparecem como **card** no fluxo do chat.

## Exceção (bootstrapping)

`super_admin` pode criar grupo/sala **direto** (sem votação) com `?direto=1` — usado
apenas para configuração inicial. Por padrão, **tudo passa pelo Canal**.
