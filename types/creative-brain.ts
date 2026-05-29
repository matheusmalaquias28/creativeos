export type ProductionRules = {
  layoutAndSpacing: string[];
  typography: string[];
  visualHierarchy: string[];
};

export type ReferenceInsight = {
  source: string;
  visualRole: string;
  signals: string[];
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
