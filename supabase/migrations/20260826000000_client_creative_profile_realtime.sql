-- Habilita Realtime na tabela de perfil criativo para que o extrator de DNA
-- visual atualize em tempo real no frontend sem precisar de page refresh.

alter publication supabase_realtime add table public.client_creative_profile;
