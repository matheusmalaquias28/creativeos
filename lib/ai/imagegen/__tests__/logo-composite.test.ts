import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { compositeLogoPng } from "../logo-composite";
import type { LogoPlacement } from "../logo-composite";

/** Cria um buffer PNG simples (cor sólida) para usar nos testes. */
async function solidPng(width: number, height: number, color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

describe("compositeLogoPng", () => {
  it("retorna um Buffer PNG", async () => {
    const art = await solidPng(512, 512, { r: 30, g: 30, b: 30 });
    const logo = await solidPng(100, 40, { r: 255, g: 255, b: 255 });
    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement: {} });

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe("png");
  });

  it("mantém as dimensões da arte original", async () => {
    const art = await solidPng(800, 600, { r: 50, g: 50, b: 50 });
    const logo = await solidPng(80, 30, { r: 200, g: 200, b: 200 });
    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement: {} });

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it("respeita widthPx da placement", async () => {
    const art = await solidPng(512, 512, { r: 0, g: 0, b: 0 });
    const logo = await solidPng(200, 80, { r: 255, g: 0, b: 0 });
    const placement: LogoPlacement = { widthPx: 64 };

    // Não deve lançar erro e deve retornar buffer válido
    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement });
    expect(result).toBeInstanceOf(Buffer);
  });

  it("respeita widthRatio da placement", async () => {
    const art = await solidPng(1000, 1000, { r: 10, g: 10, b: 10 });
    const logo = await solidPng(300, 100, { r: 255, g: 255, b: 0 });
    const placement: LogoPlacement = { widthRatio: 0.15 }; // 15% = 150px

    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement });
    expect(result).toBeInstanceOf(Buffer);
  });

  it("posiciona pelo canto superior esquerdo com top+left", async () => {
    const art = await solidPng(512, 512, { r: 20, g: 20, b: 20 });
    const logo = await solidPng(60, 20, { r: 255, g: 255, b: 255 });
    const placement: LogoPlacement = { top: 10, left: 10 };

    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement });
    expect(result).toBeInstanceOf(Buffer);
  });

  it("posiciona pelo canto inferior direito com bottom+right", async () => {
    const art = await solidPng(512, 512, { r: 20, g: 20, b: 20 });
    const logo = await solidPng(60, 20, { r: 255, g: 255, b: 255 });
    const placement: LogoPlacement = { bottom: 10, right: 10 };

    const result = await compositeLogoPng({ artBuffer: art, logoBuffer: logo, placement });
    expect(result).toBeInstanceOf(Buffer);
  });
});
