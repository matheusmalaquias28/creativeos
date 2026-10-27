import { describe, expect, it } from "vitest";
import { formatInstagramDate, utcToZonedLocal, validateScheduledAt, zonedLocalToUtcIso } from "../schedule";

describe("fuso de São Paulo", () => {
  it("converte horário de parede em UTC (UTC−3, sem horário de verão)", () => {
    expect(zonedLocalToUtcIso("2026-10-20T18:30")).toBe("2026-10-20T21:30:00.000Z");
    expect(zonedLocalToUtcIso("2027-01-15T09:00")).toBe("2027-01-15T12:00:00.000Z");
  });

  it("ida e volta pelo valor do datetime-local", () => {
    expect(utcToZonedLocal("2026-10-20T21:30:00.000Z")).toBe("2026-10-20T18:30");
  });

  it("respeita horário de verão de outro fuso", () => {
    expect(zonedLocalToUtcIso("2026-07-01T12:00", "Europe/Lisbon")).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedLocalToUtcIso("2026-12-01T12:00", "Europe/Lisbon")).toBe("2026-12-01T12:00:00.000Z");
  });

  it("formata em pt-BR no fuso", () => {
    expect(formatInstagramDate("2026-10-20T21:30:00.000Z")).toMatch(/20\/10\/2026,? 18:30/);
  });

  it("recusa entrada malformada", () => {
    expect(() => zonedLocalToUtcIso("20/10/2026 18:30")).toThrow(/inválidas/);
  });
});

describe("validateScheduledAt", () => {
  const now = Date.parse("2026-10-18T12:00:00.000Z");
  it("exige ao menos 5 minutos de antecedência e no máximo 75 dias", () => {
    expect(validateScheduledAt("2026-10-18T12:02:00.000Z", now)).toMatch(/5 minutos/);
    expect(validateScheduledAt("2026-10-18T13:00:00.000Z", now)).toBeNull();
    expect(validateScheduledAt("2027-03-01T12:00:00.000Z", now)).toMatch(/75 dias/);
    expect(validateScheduledAt("amanhã", now)).toMatch(/inválidas/);
  });
});
