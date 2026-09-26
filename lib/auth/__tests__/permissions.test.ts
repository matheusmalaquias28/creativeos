import { describe, expect, it } from "vitest";
import { canAccessPath, homePathFor, parseRole } from "../permissions";

describe("canAccessPath", () => {
  it("carousel_creator só acessa carrosséis e as APIs que eles usam", () => {
    expect(canAccessPath("carousel_creator", "/carousel")).toBe(true);
    expect(canAccessPath("carousel_creator", "/carousel/tweet/abc")).toBe(true);
    expect(canAccessPath("carousel_creator", "/api/carousel/tweet/generate")).toBe(true);
    expect(canAccessPath("carousel_creator", "/api/gerador/generate")).toBe(true);
    expect(canAccessPath("carousel_creator", "/dashboard")).toBe(false);
    expect(canAccessPath("carousel_creator", "/gerador")).toBe(false);
    expect(canAccessPath("carousel_creator", "/carouselx")).toBe(false);
    expect(canAccessPath("carousel_creator", "/api/clients/1")).toBe(false);
    expect(canAccessPath("carousel_creator", "/usuarios")).toBe(false);
  });

  it("admin acessa tudo menos a gestão de usuários", () => {
    expect(canAccessPath("admin", "/demands")).toBe(true);
    expect(canAccessPath("admin", "/usuarios")).toBe(false);
    expect(canAccessPath("super_admin", "/usuarios")).toBe(true);
  });

  it("member não acessa nada além das rotas públicas", () => {
    expect(canAccessPath("member", "/carousel")).toBe(false);
    expect(canAccessPath("member", "/api/webhooks/make")).toBe(true);
    expect(canAccessPath("member", "/sem-acesso")).toBe(true);
  });
});

describe("roles", () => {
  it("valores desconhecidos viram member", () => {
    expect(parseRole("root")).toBe("member");
    expect(parseRole(undefined)).toBe("member");
    expect(homePathFor("carousel_creator")).toBe("/carousel");
  });
});
