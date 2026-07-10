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
 * pixel-a-pixel: a instrução de posicionamento vai direto no prompt, e o modelo
 * (supportsReferences: true) recebe a logo como uma referência nomeada.
 */
export async function generateMagnificArt(
  input: GenerateMagnificArtInput
): Promise<GenerateMagnificArtResult> {
  validateAspectRatio(input.model, input.aspectRatio);

  const referenceLines = [
    ...(input.logoUrl ? [`- logo: ${input.logoUrl}`] : []),
    ...input.references.map((r, i) => `- ${r.role ?? `referência ${i + 1}`}: ${r.url}`),
  ];

  const brief = buildCopyBrief(input);

  const prompt = [
    `Gere uma arte usando o modelo Magnific "${input.model}".`,
    referenceLines.length
      ? `Suba estas imagens de referência via creations_upload_image (uma URL por vez) antes de gerar:\n${referenceLines.join("\n")}`
      : "Não há imagens de referência disponíveis — gere apenas com base no texto abaixo.",
    input.logoUrl
      ? "Inclua a logo do cliente (referência 'logo') no canto superior esquerdo da arte, em tamanho pequeno."
      : null,
    brief || "Gere uma arte premium para redes sociais com base no estilo das referências.",
    `Chame images_generate com model="${input.model}", aspectRatio="${input.aspectRatio}", resolution="${input.resolution}", quality="${input.quality}", usando as imagens enviadas como referência.`,
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
