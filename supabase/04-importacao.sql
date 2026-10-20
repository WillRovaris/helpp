-- Helpp Home Finance — importação de extrato/fatura
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

-- Identificador do lançamento no arquivo do banco (FITID do OFX ou uma
-- "impressão digital" de data+valor+descrição no CSV). Impede importar o
-- mesmo lançamento duas vezes.
alter table public.gastos add column if not exists importacao_id text;
create unique index if not exists gastos_importacao_unica
  on public.gastos(casa_id, importacao_id) where importacao_id is not null;
