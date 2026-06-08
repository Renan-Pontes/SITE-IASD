# Assets que o Mestre pode fornecer depois

O app funciona 100% sem nada disto — são melhorias visuais opcionais.

## Ícones de tipo de arquivo (fórum de pauta)
**Não são necessários.** A discussão usa o ícone genérico `FileText` (lucide) para
todos os documentos (PDF/Word/Excel/TXT/MD) e mostra **preview real** para imagens
(jpg/png/gif/webp) com lightbox. Se quiser ícones específicos por tipo no futuro,
dá para mapear por extensão em `frontend/src/components/PautaDiscussao.tsx`.

## Logo
- Hoje: placeholder textual "✛ IASD Gestão" + favicon/ícones PWA gerados (cruz branca
  sobre verde) em `frontend/public/`.
- Substituir por: `icon-192.png`, `icon-512.png`, `icon-maskable.png`,
  `apple-touch-icon.png`, `favicon.svg` quando tiver a marca oficial.

## Fotos padrão (opcional)
- Igreja sem foto: emoji ⛪ num quadrado verde.
- Grupo sem foto: ícone de pessoas.
- Evento sem foto: barra colorida (cor da igreja → cor do grupo).
- Se quiser imagens-placeholder bonitas, colocar em `frontend/public/` e referenciar.

## Cores
- Já configuráveis na UI: cada **igreja** tem `cor_primaria` e cada **grupo** tem
  `cor` (color picker no editar). Defaults no seed. Paleta da marca em
  `frontend/tailwind.config.js`.
