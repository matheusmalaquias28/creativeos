import { describe, expect, it } from "vitest";
import {
  collectDemandDriveUrls,
  extractDriveFolderId,
  isGoogleDriveUrl,
  resolveDemandDriveFolder,
} from "@/lib/export/drive-folder";

describe("extractDriveFolderId", () => {
  it("extrai o ID de pastas do Google Drive em vários formatos", () => {
    expect(
      extractDriveFolderId(
        "https://drive.google.com/drive/folders/1iXb_QWBtcIAaKbGjcLMY17Ptx8eopgso?usp=sharing"
      )
    ).toBe("1iXb_QWBtcIAaKbGjcLMY17Ptx8eopgso");
    expect(
      extractDriveFolderId(
        "https://drive.google.com/drive/u/1/folders/1JklgBXu3ibTAZp8qLrdwJpNdHPGxr-Sf"
      )
    ).toBe("1JklgBXu3ibTAZp8qLrdwJpNdHPGxr-Sf");
    expect(
      extractDriveFolderId("https://drive.google.com/open?id=145TxGRSfJony9ak3k3V24Jvkt8qHAnEU")
    ).toBe("145TxGRSfJony9ak3k3V24Jvkt8qHAnEU");
  });

  it("NÃO trata referências com ?id= (Facebook Ads Library) como pasta do Drive", () => {
    expect(
      extractDriveFolderId("https://www.facebook.com/ads/library/?id=27259532043720369")
    ).toBeNull();
  });

  it("ignora links de referência que não são do Drive e valores-lixo", () => {
    expect(extractDriveFolderId("https://pin.it/7AmSFBGJ8")).toBeNull();
    expect(extractDriveFolderId("ntem.com")).toBeNull();
    expect(extractDriveFolderId("--")).toBeNull();
    expect(extractDriveFolderId(".")).toBeNull();
    expect(extractDriveFolderId("")).toBeNull();
  });
});

describe("isGoogleDriveUrl", () => {
  it("reconhece apenas hosts do Google", () => {
    expect(isGoogleDriveUrl("https://drive.google.com/drive/folders/abc")).toBe(true);
    expect(isGoogleDriveUrl("https://www.facebook.com/ads/library/?id=1")).toBe(false);
    expect(isGoogleDriveUrl("https://pin.it/x")).toBe(false);
    expect(isGoogleDriveUrl("ntem.com")).toBe(false);
    expect(isGoogleDriveUrl(null)).toBe(false);
  });
});

describe("resolveDemandDriveFolder", () => {
  const drive = "https://drive.google.com/drive/folders/1hb3C8iFlIj_9HTBSedDYcPdYWH2Su7r0";

  it("escolhe a pasta real do Drive mesmo quando uma referência aparece antes", () => {
    const urls = collectDemandDriveUrls({
      briefing: { driveMateriais: "", materiaisEditados: "" },
      artes: [
        { linkReferencias: "https://www.facebook.com/ads/library/?id=27259532043720369" },
        { linkReferencias: "https://pin.it/7AmSFBGJ8" },
        { linkReferencias: drive },
      ],
    });
    expect(resolveDemandDriveFolder(urls)).toEqual({
      url: drive,
      id: "1hb3C8iFlIj_9HTBSedDYcPdYWH2Su7r0",
    });
  });

  it("retorna nulo quando só há referências/lixo — não promove a pasta errada", () => {
    const urls = collectDemandDriveUrls({
      briefing: { driveMateriais: "", materiaisEditados: "" },
      artes: [
        { linkReferencias: "https://www.facebook.com/ads/library/?id=27259532043720369" },
        { linkReferencias: "ntem.com" },
        { linkReferencias: "--" },
      ],
    });
    expect(resolveDemandDriveFolder(urls)).toEqual({ url: null, id: null });
  });

  it("prioriza o driveMateriais do briefing quando presente", () => {
    const urls = collectDemandDriveUrls({
      briefing: { driveMateriais: drive, materiaisEditados: "" },
      artes: [{ linkReferencias: "https://pin.it/x" }],
    });
    expect(resolveDemandDriveFolder(urls).id).toBe("1hb3C8iFlIj_9HTBSedDYcPdYWH2Su7r0");
  });
});
