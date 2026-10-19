import { describe, it, expect, vi } from "vitest";
import { uploadInlineImages, type InlineImageUploader } from "../inline-images";

const PNG = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;
const JPG = `data:image/jpeg;base64,${Buffer.from("jpg-bytes").toString("base64")}`;

function fakeUploader() {
  return vi.fn<InlineImageUploader>(async (_bytes, mime, hash) => `https://cdn.test/${hash}.${mime.split("/")[1]}`);
}

describe("uploadInlineImages", () => {
  it("troca data URLs por URL do Storage em qualquer profundidade", async () => {
    const upload = fakeUploader();
    const graph = {
      nodes: [
        { id: "a", type: "referenciaImagem", data: { imageUrl: PNG, label: "x" } },
        { id: "b", type: "listaImagens", data: { items: ["https://ja.existe/1.png", JPG] } },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };

    const { value, uploaded } = await uploadInlineImages(graph, upload);

    expect(uploaded).toBe(2);
    expect(value.nodes[0].data.imageUrl).toMatch(/^https:\/\/cdn\.test\/[0-9a-f]{64}\.png$/);
    expect(value.nodes[1].data.items?.[0]).toBe("https://ja.existe/1.png");
    expect(value.nodes[1].data.items?.[1]).toMatch(/\.jpeg$/);
    expect(value.edges).toEqual(graph.edges);
    expect(JSON.stringify(value)).not.toContain("base64");
    // bytes decodificados chegam ao uploader
    expect(upload.mock.calls[0][0].toString()).toBe("png-bytes");
  });

  it("sobe uma vez só a mesma imagem repetida e com o mesmo hash", async () => {
    const upload = fakeUploader();
    const { value } = await uploadInlineImages({ a: PNG, b: [PNG] }, upload);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(value.a).toBe(value.b[0]);

    const again = await uploadInlineImages({ c: PNG }, upload);
    expect(again.value.c).toBe(value.a);
  });

  it("não mexe no grafo sem imagens embutidas", async () => {
    const upload = fakeUploader();
    const graph = { nodes: [{ id: "n", data: { prompt: "data: não é imagem", n: 3, ok: true, z: null } }] };

    const { value, uploaded } = await uploadInlineImages(graph, upload);

    expect(uploaded).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(value).toEqual(graph);
  });

  it("propaga a falha do upload", async () => {
    const upload = vi.fn<InlineImageUploader>(async () => {
      throw new Error("bucket fora");
    });
    await expect(uploadInlineImages({ a: PNG }, upload)).rejects.toThrow("bucket fora");
  });
});
