-- Status de falha para gerações que estouram o tempo limite ou erro de IA
alter type public.creative_brain_status add value if not exists 'failed';
