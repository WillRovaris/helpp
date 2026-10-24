-- Helpp Home Finance — saldo do mês anterior corrigido à mão
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.
--
-- O que sobra num mês passa sozinho para o seguinte (calculado no app).
-- Quando a pessoa corrige esse valor, ele fica guardado aqui: { "2026-11": 350.00 }.

alter table public.casas add column if not exists saldos_iniciais jsonb not null default '{}'::jsonb;
