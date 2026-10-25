-- Helpp — nome dado pela pessoa a uma importação (ex.: "Extrato Bradesco conta salário")
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

alter table public.importacoes add column if not exists nome text;
