-- Helpp Home Finance — entradas (receitas): salário, atividade extra, comissão, bônus...
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- Cada entrada tem um tipo (ícone escolhido na hora de lançar). "recorrente" = repete
-- todo mês a partir do mês da data (ex.: salário) até o mês "ate" (YYYY-MM), se houver.

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  valor numeric(12,2) not null,
  tipo text not null default 'outro',
  descricao text,
  data date not null default current_date,
  recebido_por uuid,
  recorrente boolean not null default false,
  ate text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receitas_casa_idx on public.receitas(casa_id, data);
create index if not exists receitas_updated_at_idx on public.receitas(updated_at);

alter table public.receitas enable row level security;
drop policy if exists receitas_membro on public.receitas;
create policy receitas_membro on public.receitas for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

-- sincronização (igual às outras tabelas)
drop trigger if exists receitas_updated_at on public.receitas;
create trigger receitas_updated_at before update on public.receitas
  for each row execute function public.tocar_updated_at();
drop trigger if exists receitas_exclusao on public.receitas;
create trigger receitas_exclusao after delete on public.receitas
  for each row execute function public.registrar_exclusao();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receitas'
  ) then
    alter publication supabase_realtime add table public.receitas;
  end if;
end $$;
