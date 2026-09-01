-- Business/brand context for the Gerador Turbo guided AI generation.
ALTER TABLE carousel_profiles
  ADD COLUMN IF NOT EXISTS business_context TEXT,
  ADD COLUMN IF NOT EXISTS context_md TEXT;
