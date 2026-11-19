/**
 * Camada de imagem do Studio → PNG pronto no tamanho da caixa (servidor).
 *
 * Reproduz em sharp o que o editor faz com CSS (frame-renderer.tsx):
 * object-fit cover/contain com ponto focal, zoom a partir do foco, espelhar,
 * filtros (brilho, contraste, saturação, desfoque), cantos arredondados e a
 * sombra "drop-shadow(0 30px 40px rgba(0,0,0,.35))". O Satori só posiciona.
 */

import sharp, { type OverlayOptions } from "sharp";
import type { StudioImageLayer } from "@/types/carousel-studio";

/** Folga em volta da caixa quando há sombra (a sombra vaza da caixa). */
export const SHADOW_PAD = 80;

export type PreparedImage = {
  /** data:image/png;base64,… */
  src: string;
  /** Posição/tamanho relativos à caixa da camada (negativos quando há sombra). */
  left: number;
  top: number;
  width: number;
  height: number;
};

async function download(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) return Buffer.from(src.split(",")[1] ?? "", "base64");
  const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Imagem indisponível (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Geometria do object-fit + object-position + zoom (puro, testado). */
export function placeImage(params: {
  boxW: number;
  boxH: number;
  imgW: number;
  imgH: number;
  fit: "cover" | "contain";
  focusX: number;
  focusY: number;
  zoom: number;
}): { left: number; top: number; width: number; height: number } {
  const { boxW, boxH, imgW, imgH } = params;
  const fx = Math.max(0, Math.min(100, params.focusX)) / 100;
  const fy = Math.max(0, Math.min(100, params.focusY)) / 100;
  const base = params.fit === "cover" ? Math.max(boxW / imgW, boxH / imgH) : Math.min(boxW / imgW, boxH / imgH);
  const w0 = imgW * base;
  const h0 = imgH * base;
  const left0 = (boxW - w0) * fx;
  const top0 = (boxH - h0) * fy;
  const zoom = params.fit === "cover" ? Math.max(1, params.zoom || 1) : 1;
  // scale(zoom) com transform-origin no ponto focal da caixa.
  const ox = boxW * fx;
  const oy = boxH * fy;
  return {
    left: ox + (left0 - ox) * zoom,
    top: oy + (top0 - oy) * zoom,
    width: w0 * zoom,
    height: h0 * zoom,
  };
}

function roundedMask(w: number, h: number, r: number): Buffer {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  return Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
}

export async function prepareImageLayer(layer: StudioImageLayer): Promise<PreparedImage | null> {
  if (!layer.src) return null;
  const W = Math.max(1, Math.round(layer.width));
  const H = Math.max(1, Math.round(layer.height));

  let img = sharp(await download(layer.src)).rotate().ensureAlpha();
  if (layer.flipX) img = img.flop();
  const meta = await sharp(await img.png().toBuffer()).metadata();
  const placed = placeImage({
    boxW: W,
    boxH: H,
    imgW: meta.width ?? W,
    imgH: meta.height ?? H,
    fit: layer.fit,
    focusX: layer.focusX,
    focusY: layer.focusY,
    zoom: layer.zoom,
  });
  const sw = Math.max(1, Math.round(placed.width));
  const sh = Math.max(1, Math.round(placed.height));
  let scaled = await img.resize(sw, sh, { fit: "fill" }).png().toBuffer();

  // Filtros CSS (100 = neutro).
  const brightness = (layer.brightness ?? 100) / 100;
  const saturation = (layer.saturate ?? 100) / 100;
  const contrast = (layer.contrast ?? 100) / 100;
  if (brightness !== 1 || saturation !== 1 || contrast !== 1 || (layer.blur ?? 0) > 0) {
    let f = sharp(scaled);
    if (brightness !== 1 || saturation !== 1) f = f.modulate({ brightness, saturation });
    if (contrast !== 1) f = f.linear(contrast, 128 * (1 - contrast));
    if ((layer.blur ?? 0) > 0) f = f.blur(Math.max(0.3, layer.blur!));
    scaled = await f.png().toBuffer();
  }

  // Recorta na caixa (o que sai da caixa some, como overflow: hidden). O sharp
  // não aceita sobreposição maior que o quadro: recorta antes a parte visível.
  const left = Math.round(placed.left);
  const top = Math.round(placed.top);
  const cropX = Math.max(0, -left);
  const cropY = Math.max(0, -top);
  const cropW = Math.min(sw - cropX, W - Math.max(0, left));
  const cropH = Math.min(sh - cropY, H - Math.max(0, top));
  const layers: OverlayOptions[] = [];
  if (cropW > 0 && cropH > 0) {
    const visible = await sharp(scaled).extract({ left: cropX, top: cropY, width: cropW, height: cropH }).png().toBuffer();
    layers.push({ input: visible, left: Math.max(0, left), top: Math.max(0, top) });
  }
  let boxed = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
  if (layer.radius > 0) {
    boxed = await sharp(boxed)
      .composite([{ input: roundedMask(W, H, layer.radius), blend: "dest-in" }])
      .png()
      .toBuffer();
  }

  if (!layer.shadow) {
    return { src: `data:image/png;base64,${boxed.toString("base64")}`, left: 0, top: 0, width: W, height: H };
  }

  // drop-shadow(0 30px 40px rgba(0,0,0,.35)): borrão do alfa, deslocado 30px.
  const P = SHADOW_PAD;
  const alpha = await sharp(boxed).extractChannel(3).toBuffer();
  const shadowSolid = await sharp({ create: { width: W, height: H, channels: 3, background: "#000000" } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  const { data, info } = await sharp(shadowSolid)
    .extend({ top: P, bottom: P, left: P, right: P, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(20)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.35);
  // Desce 30px: corta o fim da sombra para caber no quadro (sharp não deixa vazar).
  const offsetY = 30;
  const shadow = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: 0, top: 0, width: info.width, height: info.height - offsetY })
    .png()
    .toBuffer();
  const out = await sharp({
    create: { width: W + P * 2, height: H + P * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadow, left: 0, top: offsetY },
      { input: boxed, left: P, top: P },
    ])
    .png()
    .toBuffer();
  return { src: `data:image/png;base64,${out.toString("base64")}`, left: -P, top: -P, width: W + P * 2, height: H + P * 2 };
}
