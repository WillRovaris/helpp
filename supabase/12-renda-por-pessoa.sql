-- Helpp Home Finance — renda de cada pessoa da casa
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.
--
-- Guarda quanto cada um recebe por mês ({ "id da pessoa": valor }).
-- A coluna renda_mensal continua sendo o total da casa.

alter table public.casas add column if not exists rendas jsonb not null default '{}'::jsonb;
