import { describe, expect, it } from "vitest";
import { commentDedupeKey, parseWarComment } from "@/lib/demands/war-comment";
import { parseWarEventDueDate } from "@/lib/demands/war-status-event";
import { dueDateToInputValue, inputValueToDueDate } from "@/lib/demands/due-date";

const NOTA = {
  id: "7a05d33e",
  nota: { autor: "Hyandra", texto: "passa uma previsão de entrega", imagens: ["https://x.supabase.co/a.png"] },
  tipo: "arte",
  event: "demanda.nota",
  addedBy: "Hyandra",
  createdAt: "2026-11-09T12:09:00.829Z",
  clientName: "Rotec Equipamentos",
};

describe("parseWarComment", () => {
  it("extrai autor, texto, imagens e data do demanda.nota", () => {
    expect(parseWarComment(NOTA)).toMatchObject({
      externalDemandId: "7a05d33e",
      author: "Hyandra",
      body: "passa uma previsão de entrega",
      images: ["https://x.supabase.co/a.png"],
      createdAt: "2026-11-09T12:09:00.829Z",
    });
  });

  it("aceita nota como string e cai no addedBy para o autor", () => {
    const c = parseWarComment({ id: "x", event: "demanda.nota", nota: "oi", addedBy: "Ana" });
    expect(c?.body).toBe("oi");
    expect(c?.author).toBe("Ana");
  });

  it("ignora evento de status e nota vazia", () => {
    expect(parseWarComment({ id: "x", event: "demanda.status", status: "Fazendo" })).toBeNull();
    expect(parseWarComment({ id: "x", event: "demanda.nota", nota: {} })).toBeNull();
  });

  it("dedupe estável para o mesmo comentário", () => {
    const a = parseWarComment(NOTA)!;
    const b = parseWarComment({ ...NOTA })!;
    expect(commentDedupeKey(a)).toBe(commentDedupeKey(b));
    expect(commentDedupeKey(a)).not.toBe(commentDedupeKey({ ...a, body: "outro" }));
  });
});

describe("parseWarEventDueDate", () => {
  it("undefined quando o evento não fala de data", () => {
    expect(parseWarEventDueDate({ id: "x", status: "Fazendo" })).toBeUndefined();
  });
  it("null quando vem vazia; ISO quando vem preenchida", () => {
    expect(parseWarEventDueDate({ id: "x", dueDate: "" })).toBeNull();
    expect(parseWarEventDueDate({ id: "x", dueDate: "2026-11-20T23:59:00-03:00" })).toBe(
      "2026-11-21T02:59:00.000Z"
    );
  });
});

describe("data de entrega no seletor", () => {
  it("input → fim do dia em São Paulo → volta para o mesmo dia", () => {
    const iso = inputValueToDueDate("2026-11-20");
    expect(iso).toBe("2026-11-21T02:59:00.000Z");
    expect(dueDateToInputValue(iso)).toBe("2026-11-20");
  });
});
