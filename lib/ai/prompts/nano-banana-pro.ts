/**
 * Diretrizes Nano Banana Pro (Gemini 3 Image) para geração de Brand DNA e criativos.
 */

export const NANO_BANANA_PRO_FORMULA = [
  "scene.subject — sujeito principal (quem/o quê, pose, escala)",
  "scene.action — narrativa visual",
  "scene.environment — ambiente e formato de superfície",
  "scene.artStyle — estilo fotográfico/editorial concreto",
  "scene.lighting — iluminação técnica (direção, Kelvin, contraste)",
  "scene.details — câmera, textura, profundidade (SEM hex, margens ou regras de layout)",
] as const;

export const ART_PRODUCTION_MANDATORY_RULES = [
  "Margens externas generosas (safe area mín. 5–8% do frame) — nunca colar elementos na borda",
  "Respiro (whitespace) entre blocos de informação — hierarquia legível, sem poluição visual",
  "Grid implícito ou explícito — alinhamento consistente",
  "Espaçamento proporcional entre título, subtítulo, CTA e corpo",
  "Tipografia: máximo 2 famílias; pesos contrastantes",
  "Tamanhos mínimos legíveis em mobile",
  "Contraste WCAG-friendly para textos sobre imagem",
  "Logo com área de proteção = altura do logotipo em todos os lados",
  "Cores da paleta como dominantes visuais — NÃO como texto escrito na arte",
  "Uma ideia principal por peça",
] as const;

export const NANO_BANANA_PROMPT_RULES = [
  "CRITICAL: generationInstructions are SILENT rules for the image model — NEVER render them as visible text, labels, captions, or UI in the artwork",
  "CRITICAL: hex codes (#RRGGBB), spacing %, margin rules, font names, JSON keys must ONLY live in generationInstructions — never in scene.* strings",
  "CRITICAL: Only visibleCopy.headline | subheadline | cta may appear as typography in the image; leave visibleCopy empty {} if no copy needed",
  "scene.* describes ONLY what the camera sees — pictorial language, not spec sheets",
  "generationInstructions holds layout, colorPalette, typography specs, brand.logoFileName, constraints",
  "Analyze attached reference images; reflect findings in referenceInsights and in scene/generationInstructions",
  "Prompts em inglês nos valores de scene; visibleCopy pode ser PT-BR",
] as const;

export const PROMPT_STRUCTURE_RULE = `Each promptTemplates[].prompt MUST have exactly this shape:
{
  "scene": { "subject", "action", "environment", "artStyle", "lighting", "details" },
  "generationInstructions": { "layout", "typography", "brand", "colorPalette", "constraints" },
  "visibleCopy": { "headline?", "subheadline?", "cta?" }
}`;
