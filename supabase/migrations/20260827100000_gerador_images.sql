CREATE TABLE public.gerador_image (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         text        NOT NULL,
  aspect_ratio text       NOT NULL DEFAULT '1:1',
  resolution  text        NOT NULL DEFAULT '2K',
  prompt      text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gerador_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_gerador_images"
  ON public.gerador_image
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
