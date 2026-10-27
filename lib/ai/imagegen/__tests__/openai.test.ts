import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeReference, REFERENCE_EDGE_MAX, resolveDimensions } from "../openai";

// Limites do gpt-image-2.5 (ver doc OpenAI / lib/ai/imagegen/openai.ts).
const EDGE_MAX = 3840;
const PIXELS_MIN = 655_360;
const PIXELS_MAX = 8_294_400;

const ASPECTS = ["1:1", "4:5", "3:4", "9:16", "16:9", "3:2", "2:3"];
const TIERS = ["1K", "2K", "4K"];

describe("resolveDimensions", () => {
  it("respeita os invariantes do gpt-image em todo aspect × faixa", () => {
    for (const aspect of ASPECTS) {
      for (const tier of TIERS) {
        const { width, height, size } = resolveDimensions(aspect, tier);

        expect(size).toBe(`${width}x${height}`);
        // múltiplos de 16
        expect(width % 16).toBe(0);
        expect(height % 16).toBe(0);
        // bordas e total de pixels dentro da janela suportada
        expect(width).toBeLessThanOrEqual(EDGE_MAX);
        expect(height).toBeLessThanOrEqual(EDGE_MAX);
        expect(width * height).toBeGreaterThanOrEqual(PIXELS_MIN);
        expect(width * height).toBeLessThanOrEqual(PIXELS_MAX);
      }
    }
  });

  it("mantém a orientação do aspect (retrato vs paisagem)", () => {
    expect(resolveDimensions("4:5", "2K").height).toBeGreaterThan(
      resolveDimensions("4:5", "2K").width
    );
    expect(resolveDimensions("9:16", "2K").height).toBeGreaterThan(
      resolveDimensions("9:16", "2K").width
    );
    expect(resolveDimensions("16:9", "2K").width).toBeGreaterThan(
      resolveDimensions("16:9", "2K").height
    );
    const square = resolveDimensions("1:1", "2K");
    expect(square.width).toBe(square.height);
  });

  it("escala o total de pixels junto com a faixa", () => {
    const area = (s: string) => {
      const d = resolveDimensions("4:5", s);
      return d.width * d.height;
    };
    expect(area("2K")).toBeGreaterThan(area("1K"));
    expect(area("4K")).toBeGreaterThan(area("2K"));
  });

  it("cai em 2K com faixa/aspect inválidos sem quebrar os limites", () => {
    const d = resolveDimensions(undefined, undefined);
    expect(d.width * d.height).toBeGreaterThanOrEqual(PIXELS_MIN);
    expect(d.width * d.height).toBeLessThanOrEqual(PIXELS_MAX);
    const bogus = resolveDimensions("0:0", "9000K");
    expect(bogus.width % 16).toBe(0);
    expect(bogus.height % 16).toBe(0);
  });
});

describe("normalizeReference", () => {
  it("reduz referência gigante com transparência para PNG dentro do limite", async () => {
    const huge = await sharp({
      create: { width: 6000, height: 2000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const { bytes, mime } = await normalizeReference(huge);
    const meta = await sharp(bytes).metadata();

    expect(mime).toBe("image/png");
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect(Math.max(meta.width!, meta.height!)).toBe(REFERENCE_EDGE_MAX);
    // proporção preservada
    expect(meta.width! / meta.height!).toBeCloseTo(3, 1);
  });

  it("converte CMYK sem transparência para JPEG sRGB", async () => {
    const cmyk = await sharp({
      create: { width: 400, height: 500, channels: 3, background: { r: 200, g: 30, b: 30 } },
    }).toColorspace("cmyk").jpeg().toBuffer();
    expect((await sharp(cmyk).metadata()).space).toBe("cmyk");

    const { bytes, mime } = await normalizeReference(cmyk);
    const meta = await sharp(bytes).metadata();

    expect(mime).toBe("image/jpeg");
    expect(meta.space).toBe("srgb");
  });

  it("não amplia imagem pequena", async () => {
    const small = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).webp().toBuffer();

    const { bytes, mime } = await normalizeReference(small);
    const meta = await sharp(bytes).metadata();

    expect(mime).toBe("image/jpeg");
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("rejeita bytes que não são imagem", async () => {
    await expect(normalizeReference(Buffer.from("not an image"))).rejects.toThrow();
  });
});
