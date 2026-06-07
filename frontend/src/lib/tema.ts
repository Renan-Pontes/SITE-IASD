// Gerencia o tema (claro/escuro/sistema), persistido no localStorage.

export type Tema = "light" | "dark" | "system";
const KEY = "iasd_tema";

export function getTema(): Tema {
  return (localStorage.getItem(KEY) as Tema) || "system";
}

function prefereEscuro() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function aplicarTema(t: Tema) {
  const escuro = t === "dark" || (t === "system" && prefereEscuro());
  document.documentElement.classList.toggle("dark", escuro);
  // Atualiza a cor da barra do navegador (mobile).
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", escuro ? "#0f172a" : "#047857");
}

export function setTema(t: Tema) {
  localStorage.setItem(KEY, t);
  aplicarTema(t);
}

export function initTema() {
  aplicarTema(getTema());
  // Reage à mudança do sistema quando no modo "system".
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getTema() === "system") aplicarTema("system");
    });
}
