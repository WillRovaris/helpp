-- Helpp Home Finance — etapa 3
-- Renda mensal (opcional) da casa, para mostrar "quanto sobra" no resumo do mês.
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar → Run.

alter table public.casas add column if not exists renda_mensal numeric(12,2);

-- Para o outro celular ver na hora quando a renda mudar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casas'
  ) then
    alter publication supabase_realtime add table public.casas;
  end if;
end $$;
