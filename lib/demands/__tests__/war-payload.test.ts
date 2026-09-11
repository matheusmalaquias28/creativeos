import { describe, expect, it } from "vitest";
import { parseMakeDemandPayload } from "@/lib/demands/parse-make-payload";
import {
  collectDemandDriveUrls,
  resolveDemandDriveFolder,
} from "@/lib/export/drive-folder";

// Pasta com ID realista (o "xxx" do exemplo do WAR é só placeholder).
const FOLDER = "https://drive.google.com/drive/folders/1hb3C8iFlIj_9HTBSedDYcPdYWH2Su7r0";
const FOLDER_ID = "1hb3C8iFlIj_9HTBSedDYcPdYWH2Su7r0";

const WAR_PAYLOAD = {
  id: "8f3c2a1b-4d5e-6789-abcd-ef0123456789",
  tipo: "arte",
  clientName: "Nome do Cliente",
  status: "Aguardando Definição de Data",
  dueDate: "",
  createdAt: "2026-09-10T04:38:00.000Z",
  briefing: {
    titulo: "Campanha Setembro",
    driveMateriais: FOLDER,
    quantidadeArtes: 2,
    materiaisEditados: "",
    artes: [{ headline: "H1", linkReferencias: "https://drive.google.com/file/yyy" }],
  },
  driveMateriais: FOLDER,
  artes: [
    {
      index: 1,
      headline: "Headline 1",
      linkReferencias: "https://drive.google.com/file/yyy",
      imagensReferencias: [
        "https://xxxx.supabase.co/storage/v1/object/public/chat-attachments/arte1.png",
      ],
    },
    {
      index: 2,
      headline: "Headline 2",
      linkReferencias: "",
      imagensReferencias: [
        "https://xxxx.supabase.co/storage/v1/object/public/chat-attachments/arte2.png",
      ],
    },
  ],
  clientId: "1710000000000-abc12",
  cliente: { id: "1710000000000-abc12", drive: FOLDER },
};

describe("WAR direct payload", () => {
  it("mapeia a pasta do Drive corretamente (driveMateriais vence o file de referência)", () => {
    const parsed = parseMakeDemandPayload(WAR_PAYLOAD)!;
    expect(parsed.externalId).toBe("8f3c2a1b-4d5e-6789-abcd-ef0123456789");
    expect(parsed.externalClientId).toBe("1710000000000-abc12");
    expect(parsed.briefing.driveMateriais).toBe(FOLDER);
    expect(parsed.artes).toHaveLength(2);
    expect(parsed.referenceImageUrls).toHaveLength(2);

    const folder = resolveDemandDriveFolder(
      collectDemandDriveUrls({ briefing: parsed.briefing, artes: parsed.artes })
    );
    expect(folder).toEqual({ url: FOLDER, id: FOLDER_ID });
  });

  it("cai no cliente.drive se briefing.driveMateriais vier vazio", () => {
    const p = {
      ...WAR_PAYLOAD,
      briefing: { ...WAR_PAYLOAD.briefing, driveMateriais: "" },
      driveMateriais: "",
    };
    const parsed = parseMakeDemandPayload(p)!;
    expect(parsed.briefing.driveMateriais).toBe(FOLDER);
  });
});
