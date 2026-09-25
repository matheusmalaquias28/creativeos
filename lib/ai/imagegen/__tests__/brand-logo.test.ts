import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  compositeBrandLogo,
  contrastRatio,
  hexToRgb,
  LOGO_ZONE,
  prepareLogo,
  relativeLuminance,
} from "../brand-logo";

/** Logo "dourada" (retângulo) sobre fundo azul chapado, sem alpha — como um JPG. */
async function flatLogo(): Promise<Buffer> {
  const gold = await sharp({
    create: { width: 200, height: 60, channels: 3, background: { r: 201, g: 160, b: 90 } },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 10, g: 22, b: 52 } },
  })
    .composite([{ input: gold, left: 100, top: 70 }])
    .jpeg()
    .toBuffer();
}

function solid(width: number, height: number, rgb: [number, number, number]) {
  return sharp({
    create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  })
    .png()
    .toBuffer();
}

async function pixel(buf: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe("cor", () => {
  it("calcula contraste WCAG", () => {
    expect(contrastRatio(relativeLuminance(255, 255, 255), relativeLuminance(0, 0, 0))).toBeCloseTo(21, 0);
    expect(contrastRatio(0.5, 0.5)).toBe(1);
  });

  it("converte hex", () => {
    expect(hexToRgb("#1A3A52")).toEqual([26, 58, 82]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("azul")).toBeNull();
  });
});

describe("prepareLogo", () => {
  it("remove o fundo chapado e recorta rente ao desenho", async () => {
    const out = await prepareLogo(await flatLogo());
    const meta = await sharp(out).metadata();
    expect(meta.hasAlpha).toBe(true);
    // Recortado ao retângulo dourado (com tolerância de borda do JPG).
    expect(meta.width).toBeGreaterThanOrEqual(196);
    expect(meta.width).toBeLessThanOrEqual(206);
    const [r, , , a] = await pixel(out, Math.floor((meta.width ?? 0) / 2), Math.floor((meta.height ?? 0) / 2));
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(180);
  });

  it("mantém logos que já têm transparência", async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await solid(40, 40, [255, 0, 0]), left: 30, top: 30 }])
      .png()
      .toBuffer();
    const out = await prepareLogo(png);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(40);
  });
});

describe("compositeBrandLogo", () => {
  it("posiciona no topo central e mantém a cor original quando há contraste", async () => {
    const logo = await prepareLogo(await flatLogo());
    const art = await solid(1000, 1333, [12, 20, 40]);
    const res = await compositeBrandLogo({ art, logo });
    expect(res.variant).toBe("original");
    expect(res.contrast).toBeGreaterThanOrEqual(3);
    const top = Math.round(1333 * LOGO_ZONE.top);
    const [r] = await pixel(res.buffer, 500, top + 5);
    expect(r).toBeGreaterThan(150); // dourado no centro, no topo
  });

  it("recolore a logo para a cor escura da paleta em fundo claro", async () => {
    const logo = await prepareLogo(await flatLogo());
    const art = await solid(1000, 1333, [245, 240, 232]);
    const res = await compositeBrandLogo({ art, logo, palette: ["#A68B5B", "#1A3A52", "#F5F1ED"] });
    expect(res.variant).toBe("#1A3A52");
    expect(res.contrast).toBeGreaterThanOrEqual(3);
  });

  it("usa logo branca em fundo escuro quando a cor original some", async () => {
    const darkLogo = await prepareLogo(
      await sharp({ create: { width: 300, height: 120, channels: 3, background: { r: 250, g: 250, b: 250 } } })
        .composite([{ input: await solid(150, 40, [20, 20, 30]), left: 75, top: 40 }])
        .png()
        .toBuffer()
    );
    const art = await solid(1000, 1333, [15, 15, 20]);
    const res = await compositeBrandLogo({ art, logo: darkLogo });
    expect(res.variant).toBe("#FFFFFF");
  });
});
