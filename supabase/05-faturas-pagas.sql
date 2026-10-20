-- Helpp Home Finance — marcar fatura do cartão como paga
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

create table if not exists public.faturas_pagas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  cartao_id uuid not null references public.cartoes(id) on delete cascade,
  vencimento date not null,       -- identifica a fatura (dia de vencimento dela)
  valor numeric(12,2),
  pago_em date not null default current_date,
  created_at timestamptz not null default now(),
  unique (cartao_id, vencimento)
);

alter table public.faturas_pagas enable row level security;
drop policy if exists faturas_pagas_membro on public.faturas_pagas;
create policy faturas_pagas_membro on public.faturas_pagas for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'faturas_pagas'
  ) then
    alter publication supabase_realtime add table public.faturas_pagas;
  end if;
end $$;
