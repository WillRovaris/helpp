-- Helpp — caixinhas (objetivos: viagem, reserva de emergência...)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- caixinhas: o objetivo (nome, emoji, cor, meta, data alvo).
-- caixinha_movimentos: cada vez que guarda (+) ou tira (−) dinheiro dela.

create table if not exists public.caixinhas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  emoji text not null default '🐷',
  cor text not null default '#E11D48',
  meta numeric(12,2),
  data_alvo date,
  arquivada boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caixinha_movimentos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  caixinha_id uuid not null references public.caixinhas(id) on delete cascade,
  valor numeric(12,2) not null,          -- positivo = guardou, negativo = tirou
  data date not null default current_date,
  descricao text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists caixinhas_casa_idx on public.caixinhas(casa_id);
create index if not exists caixinhas_updated_at_idx on public.caixinhas(updated_at);
create index if not exists caixinha_mov_casa_idx on public.caixinha_movimentos(casa_id, caixinha_id);
create index if not exists caixinha_mov_updated_at_idx on public.caixinha_movimentos(updated_at);

-- segurança: só a casa vê e altera
alter table public.caixinhas enable row level security;
alter table public.caixinha_movimentos enable row level security;
drop policy if exists caixinhas_membro on public.caixinhas;
create policy caixinhas_membro on public.caixinhas for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));
drop policy if exists caixinha_movimentos_membro on public.caixinha_movimentos;
create policy caixinha_movimentos_membro on public.caixinha_movimentos for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

-- sincronização (updated_at e exclusões), autor e "mesma casa" — igual às outras tabelas
do $$
declare t text;
begin
  foreach t in array array['caixinhas', 'caixinha_movimentos'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.tocar_updated_at()', t, t);
    execute format('drop trigger if exists %I_exclusao on public.%I', t, t);
    execute format('create trigger %I_exclusao after delete on public.%I for each row execute function public.registrar_exclusao()', t, t);
    execute format('drop trigger if exists %I_autor on public.%I', t, t);
    execute format('create trigger %I_autor before insert or update on public.%I for each row execute function public.forcar_autor()', t, t);
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

drop trigger if exists caixinha_movimentos_mesma_casa on public.caixinha_movimentos;
create trigger caixinha_movimentos_mesma_casa before insert or update on public.caixinha_movimentos for each row
  execute function public.validar_mesma_casa('caixinha_id', 'caixinhas');
