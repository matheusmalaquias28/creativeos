-- Enable Supabase Realtime for new demand notifications

alter publication supabase_realtime add table public.creative_demands;
