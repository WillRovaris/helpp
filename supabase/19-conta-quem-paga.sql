-- Helpp — quem paga cada conta fixa (ex.: Luz = Will, Escola = Thamara)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

alter table public.contas_fixas add column if not exists pago_por uuid;
