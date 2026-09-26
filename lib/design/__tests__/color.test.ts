import { describe, expect, it } from "vitest";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "../color";

describe("conversão de cor", () => {
  it("hex ↔ rgb ida e volta", () => {
    expect(hexToRgb("#1d9bf0")).toEqual({ r: 29, g: 155, b: 240 });
    expect(rgbToHex({ r: 29, g: 155, b: 240 })).toBe("#1d9bf0");
  });

  it("rejeita hex inválido e limita canais", () => {
    expect(hexToRgb("#12")).toBeNull();
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe("#ff0080");
  });
});

describe("hsv", () => {
  it("rgb → hsv → rgb preserva a cor", () => {
    const rgb = { r: 249, g: 24, b: 128 };
    expect(rgbToHex(hsvToRgb(rgbToHsv(rgb)))).toBe(rgbToHex(rgb));
  });
});
