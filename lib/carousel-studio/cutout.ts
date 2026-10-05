import sharp from "sharp";

/**
 * Recorte de fundo para os elementos gerados pela IA.
 *
 * Os elementos são pedidos sobre fundo branco liso; aqui o fundo é removido
 * por "varinha mágica" a partir das bordas: tudo que é parecido com a cor da
 * borda E está conectado a ela vira transparente. Brancos dentro do objeto
 * (sem ligação com a borda) ficam intactos. A transição ganha um alpha
 * suave para o contorno não serrilhar, e o resultado é recortado no limite do
 * objeto — a camada fica justa no editor.
 */

const MAX_EDGE = 1600;

export type CutoutResult = {
  buffer: Buffer;
  /** false quando a borda não era uniforme (fundo complexo) — devolve o original. */
  removed: boolean;
  width: number;
  height: number;
};

function dist(data: Uint8Array | Buffer, i: number, r: number, g: number, b: number): number {
  const dr = data[i] - r;
  const dg = data[i + 1] - g;
  const db = data[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function removeFlatBackground(
  input: Buffer,
  opts: { tolerance?: number; padding?: number } = {}
): Promise<CutoutResult> {
  const tolerance = opts.tolerance ?? 42;
  const padding = opts.padding ?? 12;

  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = w * h;

  // Cor de fundo = média da borda; se a borda varia muito, não é fundo liso.
  let sr = 0, sg = 0, sb = 0, n = 0;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  for (const p of border) {
    const i = p * 4;
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
    n++;
  }
  const br = sr / n, bg = sg / n, bb = sb / n;
  let uniform = 0;
  for (const p of border) if (dist(data, p * 4, br, bg, bb) < tolerance) uniform++;
  if (uniform / n < 0.8) {
    const buffer = await sharp(input).png().toBuffer();
    const meta = await sharp(buffer).metadata();
    return { buffer, removed: false, width: meta.width ?? w, height: meta.height ?? h };
  }

  // Flood fill a partir da borda.
  const isBg = new Uint8Array(px);
  const stack: number[] = [];
  for (const p of border) {
    if (!isBg[p] && dist(data, p * 4, br, bg, bb) < tolerance) {
      isBg[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of neighbors) {
      if (q < 0 || isBg[q]) continue;
      if (dist(data, q * 4, br, bg, bb) < tolerance) {
        isBg[q] = 1;
        stack.push(q);
      }
    }
  }

  const out = Buffer.from(data);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0; p < px; p++) {
    const i = p * 4;
    if (isBg[p]) {
      out[i + 3] = 0;
      continue;
    }
    // Pixel de contorno (vizinho do fundo): alpha proporcional à diferença.
    const x = p % w;
    const y = (p - x) / w;
    const touchesBg =
      (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (y > 0 && isBg[p - w]) || (y < h - 1 && isBg[p + w]);
    if (touchesBg) {
      const d = dist(data, i, br, bg, bb);
      const alpha = Math.max(0, Math.min(1, (d - tolerance * 0.6) / (tolerance * 1.4)));
      out[i + 3] = Math.round(out[i + 3] * Math.max(alpha, 0.35));
    }
    if (out[i + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  let image = sharp(out, { raw: { width: w, height: h, channels: 4 } });
  if (maxX >= minX && maxY >= minY) {
    const left = Math.max(0, minX - padding);
    const top = Math.max(0, minY - padding);
    const cropW = Math.min(w - left, maxX - minX + 1 + padding * 2);
    const cropH = Math.min(h - top, maxY - minY + 1 + padding * 2);
    image = image.extract({ left, top, width: cropW, height: cropH });
    const buffer = await image.png().toBuffer();
    return { buffer, removed: true, width: cropW, height: cropH };
  }
  const buffer = await image.png().toBuffer();
  return { buffer, removed: true, width: w, height: h };
}
