export type ProductionRules = {
  layoutAndSpacing: string[];
  typography: string[];
  visualHierarchy: string[];
};

export type NanoBananaScene = {
  subject: string;
  action: string;
  environment: string;
  artStyle: string;
  lighting: string;
  details: string;
};

export type NanoBananaPromptJson = {
  scene: NanoBananaScene;
  generationInstructions: Record<string, unknown>;
  visibleCopy: {
    headline?: string;
    subheadline?: string;
    cta?: string;
  };
};

export type NanoBananaPromptTemplate = {
  name: string;
  workSurface: string;
  aspectRatio: string;
  prompt: NanoBananaPromptJson;
  /** @deprecated Legado — reprocessar o brain */
  fullPrompt?: string;
};

export type ReferenceInsight = {
  source: string;
  visualRole: string;
  signals: string[];
};

export type NanoBananaProConfig = {
  workSurfaces: string[];
  sixComponentFormula: string;
  mandatoryConstraints: string[];
  promptTemplates: NanoBananaPromptTemplate[];
};

export type BrandDna = {
  brandStyle: string;
  visualDirection: string;
  audienceProfile: string;
  preferredColors: string[];
  compositionPreferences: string[];
  negativeStyles: string[];
  recommendedHooks: string[];
  visualKeywords: string[];
  productionRules?: ProductionRules;
  referenceInsights?: ReferenceInsight[];
  nanoBananaPro?: NanoBananaProConfig;
};

export type CreativeBrainStatus =
  | "generating"
  | "draft"
  | "approved"
  | "archived"
  | "failed";

export type CreativeBrain = {
  id: string;
  client_id: string;
  brand_dna: BrandDna;
  version: number;
  status: CreativeBrainStatus;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
};
