-- Some databases created `carousels` before `post_style` was part of the base
-- migration. Ensure the column exists (and the design column) idempotently.
ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS post_style TEXT NOT NULL DEFAULT 'minimal';

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS design JSONB NOT NULL DEFAULT '{}'::jsonb;
