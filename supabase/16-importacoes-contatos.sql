-- Helpp — histórico de arquivos importados + contatos (perfil) dos usuários
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

-- 1) Histórico de importações: cada extrato/fatura que subiu, quando e por quem.
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  arquivo text,
  formato text,
  banco text,
  tipo text,                 -- 'extrato' ou 'fatura'
  cartao_id uuid,
  lancamentos integer not null default 0,
  total numeric(12,2),
  periodo_inicio date,
  periodo_fim date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists importacoes_casa_idx on public.importacoes(casa_id, created_at);
create index if not exists importacoes_updated_at_idx on public.importacoes(updated_at);

alter table public.importacoes enable row level security;
drop policy if exists importacoes_membro on public.importacoes;
create policy importacoes_membro on public.importacoes for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

drop trigger if exists importacoes_updated_at on public.importacoes;
create trigger importacoes_updated_at before update on public.importacoes
  for each row execute function public.tocar_updated_at();
drop trigger if exists importacoes_exclusao on public.importacoes;
create trigger importacoes_exclusao after delete on public.importacoes
  for each row execute function public.registrar_exclusao();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'importacoes'
  ) then
    alter publication supabase_realtime add table public.importacoes;
  end if;
end $$;

-- 2) Contatos: dados do perfil de cada usuário (lista de contatos do Helpp).
--    Cada pessoa só vê e altera o próprio; o dono do projeto vê todos no painel do Supabase.
create table if not exists public.contatos (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome text,
  email text,
  telefone text,
  aceita_novidades boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contatos enable row level security;
drop policy if exists contatos_proprio on public.contatos;
create policy contatos_proprio on public.contatos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists contatos_updated_at on public.contatos;
create trigger contatos_updated_at before update on public.contatos
  for each row execute function public.tocar_updated_at();

-- toda conta nova já entra na lista (com o e-mail); telefone vem depois, pelo perfil
create or replace function public.criar_contato() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.contatos (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists contatos_nova_conta on auth.users;
create trigger contatos_nova_conta after insert on auth.users
  for each row execute function public.criar_contato();

-- quem já tem conta
insert into public.contatos (user_id, email, nome)
select u.id, u.email, (select m.nome from public.membros m where m.user_id = u.id limit 1)
from auth.users u
on conflict (user_id) do nothing;
