-- Helpp — despesa pessoal ("só minha") + lista de compras
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

-- 1) Despesa pessoal: conta no total, mas fica fora do acerto do casal.
alter table public.gastos add column if not exists pessoal boolean not null default false;

-- 2) Lista de compras da casa (os dois veem e marcam ao vivo).
create table if not exists public.lista_compras (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  quantidade numeric(10,3) not null default 1,
  comprado boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lista_compras_casa_idx on public.lista_compras(casa_id);
create index if not exists lista_compras_updated_at_idx on public.lista_compras(updated_at);

alter table public.lista_compras enable row level security;
drop policy if exists lista_compras_membro on public.lista_compras;
create policy lista_compras_membro on public.lista_compras for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

drop trigger if exists lista_compras_updated_at on public.lista_compras;
create trigger lista_compras_updated_at before update on public.lista_compras
  for each row execute function public.tocar_updated_at();
drop trigger if exists lista_compras_exclusao on public.lista_compras;
create trigger lista_compras_exclusao after delete on public.lista_compras
  for each row execute function public.registrar_exclusao();
drop trigger if exists lista_compras_autor on public.lista_compras;
create trigger lista_compras_autor before insert or update on public.lista_compras
  for each row execute function public.forcar_autor();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lista_compras'
  ) then
    alter publication supabase_realtime add table public.lista_compras;
  end if;
end $$;
