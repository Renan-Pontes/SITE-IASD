# Princípios de UX — feito para os anciões

> "Quanto mais fácil pro usuário final e pros anciões, melhor." — o Mestre

Boa parte da liderança da igreja é idosa e tem pouca intimidade com tecnologia.
O app é desenhado em volta disso.

## Diretrizes aplicadas

- **Alvos de toque grandes** — botões com altura mínima de **48px** (`.btn` no
  `index.css`). Botões de ação principais ocupam a largura toda no mobile.
- **Fontes legíveis** — corpo a partir de 16px; títulos 18–24px. Há um interruptor
  **"fonte grande"** no perfil que aumenta a base para 19px e **escala a interface
  inteira** (tudo em `rem`). A preferência fica salva no perfil.
- **Alto contraste** — verde forte (`marca-700`/`marca-800`) sobre branco, e branco
  sobre verde. Acentos em dourado para chamadas de ação.
- **Foco visível** — contorno verde forte para navegação por teclado.
- **Confirmação antes de ações destrutivas** — modal de confirmação para excluir
  eventos, encerrar votações, etc.
- **Mensagens diretas em português**, sem jargão técnico. Erros explicam o que
  aconteceu ("E-mail ou senha incorretos.").
- **Estados claros** — toasts de sucesso/erro, skeletons no carregamento e telas
  vazias amigáveis ("Tudo em dia! ✅", "Nenhum evento neste dia").
- **Navegação simples** — barra inferior fixa com 5 destinos
  (Início · Agenda · Igrejas · Grupos · Perfil). As tarefas da liderança aparecem
  como cartões grandes no Início, não escondidas em menus.
- **Mobile-first** — pensado primeiro para o celular, onde a maioria vai usar.

## Decisões específicas para os anciões

- **Votação de pauta**: três botões enormes (Sim / Não / Abstenção) com ícone e cor.
  Resultado em barras de porcentagem, fácil de ler.
- **Aprovações**: uma caixa única ("Aprovações") junta eventos e pedidos de entrada,
  cada um com botões grandes verde (aprovar) e vermelho (rejeitar).
- **"EU VOU"**: confirmar presença num evento é um botão verde grande, impossível
  de errar.
- **Pendências no Início**: a liderança vê na hora quantos eventos/membros/pautas
  esperam por ela, em números grandes.

## Paleta

| Uso | Cor |
|-----|-----|
| Primária | `marca-700` (#047857) — verde IASD |
| Fundo suave | `marca-50` / `#f6faf8` |
| Texto | `slate-900` |
| Destaque / CTA | `ouro-500` (#f59e0b) |

> O Mestre vai trocar o design depois — as cores estão centralizadas em
> `frontend/tailwind.config.js` (paleta `marca`) e `frontend/src/index.css`.
