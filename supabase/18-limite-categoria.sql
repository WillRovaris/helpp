-- Helpp — limite de gasto por mês em cada categoria (ex.: Mercado até R$ 1.500)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

alter table public.categorias add column if not exists limite numeric(12,2);
