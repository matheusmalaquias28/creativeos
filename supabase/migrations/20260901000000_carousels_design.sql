-- Carousel-level design settings (badge / numbering / pagination).
-- Per-slide rich text and CTA live inside the existing `slides` jsonb.
ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS design JSONB NOT NULL DEFAULT '{}'::jsonb;
