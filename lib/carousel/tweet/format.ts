/**
 * Conversões de texto dos cards do carrossel tweet.
 *
 * A IA devolve texto puro com **negrito** e quebras de linha; o editor trabalha
 * com HTML (whitelist de lib/carousel/sanitize-html). Estas funções são
 * isomórficas (sem DOM) para rodar no servidor e no cliente.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto com **negrito** / *itálico* e \n → HTML inline com <br>. */
export function textToCardHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  return escapeHtml(normalized)
    .replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/\n/g, "<br>");
}

/** HTML do card → texto puro (para contagem, prévia e IA). */
export function cardHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p)>\s*<(div|p)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Tamanho automático do texto (px no canvas 1080×1350) — ponto de partida do autoajuste. */
export const TWEET_FONT_MAX = 46;
export const TWEET_FONT_MIN = 24;
