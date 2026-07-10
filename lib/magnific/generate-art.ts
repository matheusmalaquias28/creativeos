import { runMagnificAgent } from "./mcp-agent";

// Aspect ratios conhecidos por modelo Magnific — usado só pra validar antes de
// chamar (evitar um erro tardio dentro do agente). Adicionar aqui conforme surgirem
// outros modelos.
const KNOWN_ASPECT_RATIOS: Record<string, string[]> = {
  "gpt-2": [
    "auto",
    "1:1",
    "2:1",
    "3:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
    "21:9",
  ],
};

export class MagnificArtGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagnificArtGenerationError";
  }
}

export type GenerateMagnificArtInput = {
  model: string;
  quality: "low" | "medium" | "high";
  aspectRatio: string;
  /** "1k" | "2k" | "4k" — minúsculo, conforme o catálogo do Magnific. */
  resolution: string;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  briefingTitulo?: string | null;
  briefingTipo?: string | null;
  logoUrl?: string | null;
  references: { url: string; role: string | null }[];
};

export type GenerateMagnificArtResult = { imageUrl: string };

const IMAGE_RESULT_SCHEMA = {
  type: "object",
  properties: { imageUrl: { type: "string" } },
  required: ["imageUrl"],
  additionalProperties: false,
} as const;

function validateAspectRatio(model: string, aspectRatio: string): void {
  const allowed = KNOWN_ASPECT_RATIOS[model];
  if (allowed && !allowed.includes(aspectRatio)) {
    throw new MagnificArtGenerationError(
      `Aspect ratio "${aspectRatio}" não é suportado pelo modelo "${model}" (aceitos: ${allowed.join(", ")}).`
    );
  }
}

function buildCopyBrief(input: GenerateMagnificArtInput): string {
  const parts: string[] = [];

  if (input.briefingTitulo || input.briefingTipo) {
    parts.push([input.briefingTitulo, input.briefingTipo].filter(Boolean).join(" — "));
  }

  const copyParts: string[] = [];
  if (input.headline) copyParts.push(`Headline: ${input.headline}`);
  if (input.subheadline) copyParts.push(`Subheadline: ${input.subheadline}`);
  if (input.cta) copyParts.push(`CTA: ${input.cta}`);
  if (copyParts.length) parts.push(copyParts.join("  "));

  if (input.informacoesExtras) parts.push(input.informacoesExtras);

  return parts.join("\n\n");
}

/**
 * Gera UMA arte via um modelo Magnific (ex: gpt-2), delegando a um agente Claude
 * com o conector MCP — mesma abordagem de generate-space.ts. Ao contrário do
 * caminho Gemini existente (lib/ai/imagegen), não precisa de composite de logo
 * pixel-a-pixel: a logo e as referências viram entradas de `images_generate.references`
 * (type: "image", identifier retornado por creations_upload_image) — a mesma tool
 * que o agente usaria manualmente. O segredo de uma boa geração com IA é a imagem
 * de referência influenciando visualmente o resultado, não uma descrição em texto
 * dela — por isso o prompt final nunca deve narrar o conteúdo das referências.
 */
export async function generateMagnificArt(
  input: GenerateMagnificArtInput
): Promise<GenerateMagnificArtResult> {
  validateAspectRatio(input.model, input.aspectRatio);

  const uploadUrls = [
    ...(input.logoUrl ? [input.logoUrl] : []),
    ...input.references.map((r) => r.url),
  ];

  const brief = buildCopyBrief(input);

  const prompt = [
    `Gere uma arte usando o modelo Magnific "${input.model}".`,
    uploadUrls.length
      ? [
          "Suba estas imagens via creations_upload_image (uma URL por vez) e guarde o `identifier` retornado por cada upload:",
          uploadUrls.map((url, i) => `${i + 1}. ${url}`).join("\n"),
        ].join("\n")
      : "Não há imagens de referência disponíveis — gere apenas com base no texto abaixo.",
    uploadUrls.length
      ? [
          'Ao chamar images_generate, inclua TODOS os identifiers que você acabou de subir no array `references`, cada um como {"type": "image", "identifier": "<identifier>"}. Essa é a ÚNICA forma correta de usar essas imagens — elas devem influenciar a arte gerada apenas visualmente, através do `references`.',
          "NÃO descreva o conteúdo dessas imagens no campo `prompt` de images_generate: nenhuma frase sobre o que elas mostram, cores, objetos, pessoas, estilo, etc. O `prompt` deve conter só a copy/briefing abaixo e, se houver logo, a instrução de posicionamento dela — nada sobre as referências.",
        ].join("\n")
      : null,
    input.logoUrl
      ? "A logo deve aparecer no canto superior esquerdo da arte, em tamanho pequeno — inclua só essa instrução de posicionamento no `prompt`, sem descrever a logo."
      : null,
    brief || "Gere uma arte premium para redes sociais com base no estilo visual das referências.",
    `Chame images_generate com mode="${input.model}", aspectRatio="${input.aspectRatio}", resolution="${input.resolution}", quality="${input.quality}".`,
    "Aguarde a geração terminar antes de responder, e use a URL final do arquivo gerado — nunca a webUrl de preview.",
    'Quando finalizar, responda SOMENTE com um JSON no formato {"imageUrl": "..."} — sem texto antes ou depois.',
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    return await runMagnificAgent<GenerateMagnificArtResult>(prompt, IMAGE_RESULT_SCHEMA);
  } catch (error) {
    if (error instanceof MagnificArtGenerationError) throw error;
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    throw new MagnificArtGenerationError(message);
  }
}
