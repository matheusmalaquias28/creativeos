import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { isInstagramFeedRatio, toInstagramJpeg } from "../jpeg";
import { assertFeedFormat, StudioImagesError } from "../studio-images";

function png(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
}

describe("toInstagramJpeg", () => {
  it("converte a página 4:5 do Studio em JPEG sRGB sem alpha, mesmo tamanho", async () => {
    const out = await toInstagramJpeg(await png(1080, 1350));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.hasAlpha).toBe(false);
    expect(meta.space).toBe("srgb");
    expect([out.width, out.height]).toEqual([1080, 1350]);
  });

  it("reduz para 1440px de largura quando passa do máximo", async () => {
    const out = await toInstagramJpeg(await png(2160, 2160));
    expect([out.width, out.height]).toEqual([1440, 1440]);
  });

  it("recusa 9:16", async () => {
    await expect(toInstagramJpeg(await png(1080, 1920))).rejects.toThrow(/não é aceita no feed/);
  });
});

describe("proporções", () => {
  it("aceita de 4:5 a 1.91:1", () => {
    expect(isInstagramFeedRatio(1080, 1350)).toBe(true);
    expect(isInstagramFeedRatio(1080, 1080)).toBe(true);
    expect(isInstagramFeedRatio(1080, 566)).toBe(true);
    expect(isInstagramFeedRatio(1080, 1920)).toBe(false);
    expect(isInstagramFeedRatio(1080, 500)).toBe(false);
  });

  it("assertFeedFormat recusa o formato 9:16 do Studio", () => {
    expect(() => assertFeedFormat("4:5")).not.toThrow();
    expect(() => assertFeedFormat("1:1")).not.toThrow();
    expect(() => assertFeedFormat("9:16")).toThrow(StudioImagesError);
  });
});
