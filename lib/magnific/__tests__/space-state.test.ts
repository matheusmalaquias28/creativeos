import { describe, expect, it } from "vitest";
import { parseSpaceStateNodes, parseStoredSpaceNodes } from "../space-state";

// Trecho real de retorno do spaces_state (TOON), capturado em 2026-07-12
const SAMPLE = `board:
  uuid: a23ea8b8-439d-45f6-9637-e532ead839ee
  elementsCount: 6
page:
  id: 1d08af41-1aa9-436b-bd91-67b798fa1818
nodes[3]{id,type,name,selected,x,y,width,height,pageId,sourceNodeId,groupId,panelIndex,workflowStatus}:
  0b0266f8-ca60-413f-abf2-4c21ad0e396e,image-generator,Arte 1 — Atenção Trabalhadores,false,100,100,420,420,1d08af41-1aa9-436b-bd91-67b798fa1818,null,null,null,null
  b7b37831-743e-49fc-b144-5b7b2c90986d,text,"# Campanha, Auxílio-Acidente SP",false,-400,100,380,230,1d08af41-1aa9-436b-bd91-67b798fa1818,null,null,null,null
  e53f1c8a-020d-4b02-bd80-07c82c94a0d6,image-generator,Arte 2 — Você é de SP?,false,600,100,420,420,1d08af41-1aa9-436b-bd91-67b798fa1818,null,null,null,null
nodeData[1]{elementId,key,value}:
  0b0266f8-ca60-413f-abf2-4c21ad0e396e,prompt,"algo"
connections[0]:`;

describe("parseSpaceStateNodes", () => {
  it("extrai id, type e name das linhas do bloco nodes", () => {
    const nodes = parseSpaceStateNodes(SAMPLE);
    expect(nodes).toEqual([
      {
        id: "0b0266f8-ca60-413f-abf2-4c21ad0e396e",
        type: "image-generator",
        name: "Arte 1 — Atenção Trabalhadores",
      },
      {
        id: "b7b37831-743e-49fc-b144-5b7b2c90986d",
        type: "text",
        name: "# Campanha, Auxílio-Acidente SP",
      },
      {
        id: "e53f1c8a-020d-4b02-bd80-07c82c94a0d6",
        type: "image-generator",
        name: "Arte 2 — Você é de SP?",
      },
    ]);
  });

  it("para no fim do bloco (não vaza pro nodeData)", () => {
    const nodes = parseSpaceStateNodes(SAMPLE);
    expect(nodes.some((n) => n.type === "prompt")).toBe(false);
  });

  it("devolve vazio sem bloco nodes ou com input não-string", () => {
    expect(parseSpaceStateNodes("board:\n  uuid: x")).toEqual([]);
    expect(parseSpaceStateNodes({ foo: "bar" })).toEqual([]);
  });
});

describe("parseStoredSpaceNodes", () => {
  it("aceita o shape gravado e descarta entradas malformadas", () => {
    expect(
      parseStoredSpaceNodes([
        { id: "a", type: "image", name: "x" },
        { id: "b", type: "text" },
        { id: 1, type: "image" },
        "lixo",
        null,
      ])
    ).toEqual([
      { id: "a", type: "image", name: "x" },
      { id: "b", type: "text", name: "" },
    ]);
    expect(parseStoredSpaceNodes(null)).toEqual([]);
    expect(parseStoredSpaceNodes("[]")).toEqual([]);
  });
});
