/**
 * Compila o prompt final para geração de arte.
 * Narrativo e descritivo — descreve a cena, não lista keywords.
 * Determinístico e testável: mesma entrada → mesma saída.
 *
 * Ordem das referências (deve bater com a ordem das InlineDataParts enviadas ao modelo):
 *   1. Referências fixas do cliente (style_reference_urls, na ordem salva)
 *   2. Logo do cliente (apenas se logo_mode === "reference")
 *   3. Referências pontuais da demanda (demand_references, ordenadas por position)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreativeProfile = {
  base_prompt: string;
  palette: string[];
  logo_mode: "reference" | "composite";
  style_reference_urls: string[];
};

export type DemandReference = {
  url: string;
  role: string | null;
};

export type ArtSpec = {
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspect_ratio?: string;
  image_size?: string;
};

export type BriefingCopy = {
  titulo?: string | null;
  tipo?: string | null;
  instagramCliente?: string | null;
};

// ---------------------------------------------------------------------------
// buildReferenceBlock — monta o bloco enumerado de referências
// ---------------------------------------------------------------------------

function roleLabel(role: string | null): string {
  if (!role?.trim()) return "use como referência visual";
  return role.trim();
}

type RefEntry = { role: string | null };

export function buildReferenceBlock(refs: RefEntry[]): string {
  if (refs.length === 0) return "";

  const lines = refs.map(
    (r, i) => `- Imagem ${i + 1}: ${roleLabel(r.role)}.`
  );

  return (
    "Crie a arte usando as imagens de referência fornecidas, na ordem:\n" +
    lines.join("\n")
  );
}

// ---------------------------------------------------------------------------
// buildOrderedRefs — ordem canônica das referências (deve espelhar o worker)
// ---------------------------------------------------------------------------

export function buildOrderedRefs(
  profile: CreativeProfile,
  demandRefs: DemandReference[]
): RefEntry[] {
  const refs: RefEntry[] = [];

  // 1. Referências fixas do cliente (style_reference_urls)
  for (const url of profile.style_reference_urls) {
    refs.push({ role: "siga o estilo visual desta referência do cliente" });
    void url; // url usada pelo worker para baixar, aqui só precisamos da posição
  }

  // 2. Logo como referência (apenas se logo_mode === "reference")
  if (profile.logo_mode === "reference") {
    refs.push({ role: "este é o logo da marca — integre-o de forma natural na composição" });
  }

  // 3. Referências pontuais da demanda (já ordenadas por position)
  for (const ref of demandRefs) {
    refs.push({ role: ref.role });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// compilePrompt
// ---------------------------------------------------------------------------

export function compilePrompt(
  profile: CreativeProfile,
  briefing: BriefingCopy,
  artSpec: ArtSpec,
  demandRefs: DemandReference[] = []
): string {
  const parts: string[] = [];

  // 1. Base do cliente (identidade visual, estilo)
  if (profile.base_prompt.trim()) {
    parts.push(profile.base_prompt.trim());
  }

  // 2. Contexto da demanda
  if (briefing.titulo) {
    parts.push(`Esta arte é para a campanha: "${briefing.titulo}".`);
  }
  if (briefing.tipo) {
    parts.push(`Formato/tipo de arte: ${briefing.tipo}.`);
  }

  // 3. Bloco de referências enumeradas (se houver alguma)
  const orderedRefs = buildOrderedRefs(profile, demandRefs);
  const refBlock = buildReferenceBlock(orderedRefs);
  if (refBlock) {
    parts.push(refBlock);
  }

  // 4. Textos da arte
  const textLines: string[] = [];
  if (artSpec.headline) textLines.push(`Headline principal: "${artSpec.headline}"`);
  if (artSpec.subheadline) textLines.push(`Subheadline: "${artSpec.subheadline}"`);
  if (artSpec.cta) textLines.push(`Call-to-action: "${artSpec.cta}"`);
  if (artSpec.informacoesExtras) textLines.push(`Informações adicionais: ${artSpec.informacoesExtras}`);

  if (textLines.length > 0) {
    parts.push(
      "Incorpore os seguintes textos na composição visual de forma elegante e legível:\n" +
        textLines.map((l) => `- ${l}`).join("\n")
    );
  }

  // 5. Paleta de cores
  if (profile.palette.length > 0) {
    parts.push(
      `Use a paleta de cores da marca como base dominante: ${profile.palette.join(", ")}. ` +
        "Estas cores devem aparecer nos elementos principais, fundo ou gradientes."
    );
  }

  // 6. Especificações técnicas
  const techParts: string[] = [];
  if (artSpec.aspect_ratio) techParts.push(`proporção ${artSpec.aspect_ratio}`);
  if (artSpec.image_size) techParts.push(`resolução ${artSpec.image_size}`);
  if (techParts.length > 0) {
    parts.push(`Produção profissional, ${techParts.join(", ")}, pronta para uso em redes sociais.`);
  }

  return parts.join("\n\n");
}
