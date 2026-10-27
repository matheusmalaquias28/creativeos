import { describe, expect, it } from "vitest";
import { parseWarStatusEvent } from "@/lib/demands/war-status-event";

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
