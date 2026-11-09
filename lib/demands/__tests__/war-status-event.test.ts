import { describe, expect, it } from "vitest";
import { parseWarDemandEvent, parseWarStatusEvent } from "@/lib/demands/war-status-event";

describe("parseWarStatusEvent", () => {
  it("reconhece o evento demanda.status do WAR", () => {
    expect(
      parseWarStatusEvent({
        id: "ext-1",
        tipo: "arte",
        event: "demanda.status",
        status: "Em Fila",
        previousStatus: "Aguardando Definição de Data",
        updatedBy: "Fulano",
        clientName: "Cliente",
      })
    ).toEqual({ externalId: "ext-1", status: "Em Fila", event: "demanda.status" });
  });

  it("sem `event`, reconhece por previousStatus sem conteúdo de demanda", () => {
    expect(parseWarStatusEvent({ id: "ext-1", status: "Fazendo", previousStatus: "Em Fila" })?.status).toBe(
      "Fazendo"
    );
  });

  it("payload de criação não é evento de status", () => {
    expect(
      parseWarStatusEvent({
        id: "ext-1",
        status: "Aguardando Definição de Data",
        clientName: "Cliente",
        briefing: { titulo: "Campanha" },
        artes: [],
      })
    ).toBeNull();
  });
});

describe("parseWarDemandEvent", () => {
  it("comentário (demanda.nota) é evento sem status — nunca vira criação", () => {
    expect(
      parseWarDemandEvent({
        id: "7a05d33e",
        nota: { autor: "Hyandra", texto: "passa uma previsão de entrega", imagens: [] },
        tipo: "arte",
        event: "demanda.nota",
        addedBy: "Hyandra",
        createdAt: "2026-11-09T12:09:00.829Z",
        clientName: "Rotec Equipamentos",
      })
    ).toEqual({ externalId: "7a05d33e", status: null, event: "demanda.nota" });
  });

  it("comentário de vídeo também é evento (não cai na ingestão de vídeo)", () => {
    expect(
      parseWarDemandEvent({ id: "v1", tipo: "video", event: "demanda.nota", clientName: "C", nota: {} })
    ).not.toBeNull();
  });

  it("comentário com status aplica só o status", () => {
    expect(
      parseWarDemandEvent({ id: "x", event: "demanda.nota", status: "Fazendo", clientName: "C" })?.status
    ).toBe("Fazendo");
  });

  it("comentário com briefing anexado continua sendo só evento", () => {
    expect(
      parseWarDemandEvent({ id: "x", event: "demanda.nota", clientName: "C", briefing: {}, artes: [] })
    ).not.toBeNull();
  });

  it("evento desconhecido sem conteúdo de demanda não é criação", () => {
    expect(parseWarDemandEvent({ id: "x", event: "demanda.arquivo", clientName: "C" })).not.toBeNull();
  });

  it("payload de criação (com ou sem event) segue para o upsert", () => {
    const creation = {
      id: "x",
      clientName: "C",
      status: "Em Fila",
      briefing: { titulo: "Campanha" },
      artes: [{ headline: "Oi" }],
    };
    expect(parseWarDemandEvent(creation)).toBeNull();
    expect(parseWarDemandEvent({ ...creation, event: "demanda.criada" })).toBeNull();
  });
});
