import { describe, expect, it } from "vitest";
import { cardHtmlToText, textToCardHtml } from "../format";

describe("textToCardHtml", () => {
  it("converte negrito, itálico e quebras de linha", () => {
    expect(textToCardHtml("Quem fala **primeiro** perde.\n\nQuem *pergunta* ganha.")).toBe(
      "Quem fala <b>primeiro</b> perde.<br><br>Quem <i>pergunta</i> ganha."
    );
  });

  it("escapa HTML do texto de entrada", () => {
    expect(textToCardHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});

describe("cardHtmlToText", () => {
  it("faz o caminho inverso", () => {
    const text = 'Ele pergunta "quanto custa?"\n\nPorque <não> ouviu a dor.';
    expect(cardHtmlToText(textToCardHtml(text))).toBe(text);
  });

  it("trata divs do contentEditable como quebra de linha", () => {
    expect(cardHtmlToText("<div>linha 1</div><div>linha 2</div>")).toBe("linha 1\nlinha 2");
  });
});
