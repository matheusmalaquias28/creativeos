import { describe, expect, it } from "vitest";
import { assignListDriveSlots } from "@/lib/export/list-drive-slots";

describe("assignListDriveSlots", () => {
  it("mantém cada imagem na arte de origem", () => {
    expect(assignListDriveSlots([2, 1, 3], 3)).toEqual([2, 1, 3]);
  });

  it("dá um slot a toda imagem quando a demanda não tem artes no briefing", () => {
    expect(assignListDriveSlots([null, null, null], 0)).toEqual([1, 2, 3]);
  });

  it("preenche os slots livres, em ordem, com as imagens sem origem", () => {
    expect(assignListDriveSlots([null, 2, null], 3)).toEqual([1, 2, 3]);
  });

  it("manda variações extras de uma arte para depois das artes da demanda", () => {
    expect(assignListDriveSlots([1, 1, 2, 1], 3)).toEqual([1, 4, 2, 5]);
  });

  it("aceita mais imagens do que artes", () => {
    expect(assignListDriveSlots([null, null, null, null, null], 2)).toEqual([1, 2, 3, 4, 5]);
  });
});
