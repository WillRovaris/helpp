-- Helpp — correções do tipo de produto (proteínas, frutas, frios...)
-- O app descobre o tipo pelo nome da nota; aqui fica só o que a pessoa corrigiu, valendo para a casa.
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

create table if not exists public.produto_grupos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  chave text not null,
  grupo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists produto_grupos_casa_idx on public.produto_grupos(casa_id);
create index if not exists produto_grupos_updated_at_idx on public.produto_grupos(updated_at);

alter table public.produto_grupos enable row level security;
drop policy if exists produto_grupos_membro on public.produto_grupos;
create policy produto_grupos_membro on public.produto_grupos for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

drop trigger if exists produto_grupos_updated_at on public.produto_grupos;
create trigger produto_grupos_updated_at before update on public.produto_grupos
  for each row execute function public.tocar_updated_at();
drop trigger if exists produto_grupos_exclusao on public.produto_grupos;
create trigger produto_grupos_exclusao after delete on public.produto_grupos
  for each row execute function public.registrar_exclusao();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'produto_grupos'
  ) then
    alter publication supabase_realtime add table public.produto_grupos;
  end if;
end $$;
