import { marked } from "marked";
import DOMPurify from "dompurify";

// Links externos abrem em nova aba com rel seguro.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

marked.setOptions({ breaks: true, gfm: true });

/** Renderiza Markdown para HTML sanitizado (sem HTML cru, anti-XSS). */
export function renderMarkdown(texto: string): string {
  const html = marked.parse(texto || "", { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
