-- Helpp Home Finance — período das contas fixas (ex.: plano de saúde por 12 meses)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

-- inicio: primeiro mês em que a conta vale (sempre dia 1). Vazio = desde sempre.
-- meses:  por quantos meses (a partir do início). Vazio = sem prazo.
alter table public.contas_fixas add column if not exists inicio date;
alter table public.contas_fixas add column if not exists meses int check (meses is null or meses between 1 and 120);
