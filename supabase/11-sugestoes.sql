-- Helpp Home Finance — sugestões e melhorias
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- Quem usa o app escreve ideias em Configurações → "Sugestões e melhorias";
-- todos da casa veem a lista e marcam como feita quando a melhoria chega no app.

create table if not exists public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  texto text not null,
  feita boolean not null default false,
  feita_em timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sugestoes_casa_idx on public.sugestoes(casa_id);
create index if not exists sugestoes_updated_at_idx on public.sugestoes(updated_at);

alter table public.sugestoes enable row level security;
drop policy if exists sugestoes_membro on public.sugestoes;
create policy sugestoes_membro on public.sugestoes for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

-- updated_at sozinho e registro de exclusão (sincronização, igual às outras tabelas)
drop trigger if exists sugestoes_updated_at on public.sugestoes;
create trigger sugestoes_updated_at before update on public.sugestoes
  for each row execute function public.tocar_updated_at();
drop trigger if exists sugestoes_exclusao on public.sugestoes;
create trigger sugestoes_exclusao after delete on public.sugestoes
  for each row execute function public.registrar_exclusao();

-- tempo real
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sugestoes'
  ) then
    alter publication supabase_realtime add table public.sugestoes;
  end if;
end $$;
