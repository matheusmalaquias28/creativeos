/**
 * Layout do card "print de tweet" (puro, testado): parágrafos/palavras com
 * negrito e o tamanho de fonte que cabe no card 1080×1350.
 */

import { TWEET_FONT_MAX, TWEET_FONT_MIN } from "@/lib/carousel/tweet/format";
import { TWEET_CANVAS } from "@/types/tweet-carousel";

export const PAD_X = 80;
export const PAD_Y = 90;
export const AVATAR = 104;
const HEADER_H = AVATAR;
export const BODY_GAP = 44;
export const LINE_HEIGHT = 1.38;
/** Largura média de um caractere do Inter, em "em" (conservador). */
const CHAR_EM = 0.54;
const BOLD_EXTRA = 0.04;

/**
 * Uma palavra pode misturar negrito e normal sem espaço no meio
 * (`**"vou pensar"**.`): por isso ela é uma lista de pedaços.
 */
export type TweetWord = { parts: { text: string; bold: boolean }[] };

/** "texto com **negrito**\n\noutro parágrafo" → parágrafos de palavras. */
export function parseTweetText(text: string): TweetWord[][] {
  const paragraphs = text.replace(/\r\n?/g, "\n").trim().split(/\n+/);
  return paragraphs
    .map((para) => {
      const words: TweetWord[] = [];
      let current: TweetWord | null = null;
      for (const segment of para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)) {
        const bold = /^\*\*[^*]+\*\*$/.test(segment);
        const clean = (bold ? segment.slice(2, -2) : segment).replace(/\*/g, "");
        for (const token of clean.split(/(\s+)/)) {
          if (!token) continue;
          if (/^\s+$/.test(token)) {
            current = null; // espaço: a próxima palavra começa separada
            continue;
          }
          if (!current) {
            current = { parts: [] };
            words.push(current);
          }
          current.parts.push({ text: token, bold });
        }
      }
      return words;
    })
    .filter((p) => p.length > 0);
}

export function wordText(word: TweetWord): string {
  return word.parts.map((p) => p.text).join("");
}

/** Quantas linhas um parágrafo ocupa numa largura, com quebra por palavra. */
function lineCount(words: TweetWord[], fontSize: number, width: number): number {
  const space = fontSize * 0.28;
  let lines = 1;
  let x = 0;
  for (const w of words) {
    const ww = w.parts.reduce(
      (sum, p) => sum + p.text.length * fontSize * (CHAR_EM + (p.bold ? BOLD_EXTRA : 0)),
      0
    );
    if (x > 0 && x + space + ww > width) {
      lines++;
      x = ww;
    } else {
      x += (x > 0 ? space : 0) + ww;
    }
  }
  return lines;
}

/** Maior fonte (passo de 2px) em que cabeçalho + texto cabem no card. */
export function fitTweetFontSize(paragraphs: TweetWord[][]): number {
  const width = TWEET_CANVAS.width - PAD_X * 2;
  const available = TWEET_CANVAS.height - PAD_Y * 2 - HEADER_H - BODY_GAP;
  for (let size = TWEET_FONT_MAX; size > TWEET_FONT_MIN; size -= 2) {
    const lines = paragraphs.reduce((n, p) => n + lineCount(p, size, width), 0);
    const gaps = Math.max(0, paragraphs.length - 1) * size * 0.9;
    if (lines * size * LINE_HEIGHT + gaps <= available) return size;
  }
  return TWEET_FONT_MIN;
}
