import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { checkInstagramJpeg, feedFormatError, isInstagramFeedRatio, toInstagramJpeg } from "../jpeg";

function image(width: number, height: number, format: "jpeg" | "png" = "jpeg") {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } });
  return format === "jpeg" ? base.jpeg({ quality: 90 }).toBuffer() : base.png().toBuffer();
}

describe("checkInstagramJpeg", () => {
  it("aceita o card 4:5 do Studio em JPEG", async () => {
    await expect(checkInstagramJpeg(await image(1080, 1350))).resolves.toEqual({ width: 1080, height: 1350 });
  });

  it("recusa PNG", async () => {
    await expect(checkInstagramJpeg(await image(1080, 1350, "png"))).rejects.toThrow(/só aceita JPEG/);
  });

  it("recusa 9:16 e largura acima de 1440", async () => {
    await expect(checkInstagramJpeg(await image(1080, 1920))).rejects.toThrow(/não é aceita no feed/);
    await expect(checkInstagramJpeg(await image(1600, 1600))).rejects.toThrow(/1440px/);
  });
});

describe("toInstagramJpeg", () => {
  it("converte PNG com transparência em JPEG sem alpha e reduz para 1440px", async () => {
    const png = await sharp({ create: { width: 2000, height: 2000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const out = await toInstagramJpeg(png);
    const meta = await sharp(out.buffer).metadata();
    expect([meta.format, meta.hasAlpha, out.width, out.height]).toEqual(["jpeg", false, 1440, 1440]);
  });

  it("recusa a arte do stories (9:16)", async () => {
    await expect(toInstagramJpeg(await image(1080, 1920, "png"))).rejects.toThrow(/arte do feed/);
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

  it("feedFormatError recusa o formato 9:16 do Studio", () => {
    expect(feedFormatError("4:5")).toBeNull();
    expect(feedFormatError("1:1")).toBeNull();
    expect(feedFormatError("9:16")).toMatch(/9:16/);
  });
});
