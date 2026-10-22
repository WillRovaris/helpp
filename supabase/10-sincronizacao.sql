-- Helpp Home Finance — sincronização (modo offline)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- O celular guarda uma cópia dos dados e, ao sincronizar, pede só o que mudou
-- desde a última vez. Para isso cada tabela precisa de "updated_at" (quando foi
-- alterada) e as exclusões ficam registradas em "exclusoes".

-- 1) updated_at em todas as tabelas da casa (gastos já tem)
do $$
declare t text;
begin
  foreach t in array array['casas','membros','categorias','cartoes','notas','nota_itens','contas_fixas','contas_pagamentos','faturas_pagas'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
  end loop;
end $$;

-- atualiza o updated_at sozinho a cada alteração
do $$
declare t text;
begin
  foreach t in array array['casas','membros','categorias','cartoes','notas','nota_itens','gastos','contas_fixas','contas_pagamentos','faturas_pagas'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.tocar_updated_at()', t, t);
    execute format('create index if not exists %I_updated_at_idx on public.%I(updated_at)', t, t);
  end loop;
end $$;

-- 2) registro de exclusões (para o outro celular também apagar)
create table if not exists public.exclusoes (
  id bigserial primary key,
  casa_id uuid not null,
  tabela text not null,
  registro_id text not null,
  excluido_em timestamptz not null default now()
);
create index if not exists exclusoes_casa_idx on public.exclusoes(casa_id, excluido_em);

alter table public.exclusoes enable row level security;
drop policy if exists exclusoes_ver on public.exclusoes;
create policy exclusoes_ver on public.exclusoes for select to authenticated using (public.sou_membro(casa_id));

create or replace function public.registrar_exclusao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'casas' then
    insert into exclusoes (casa_id, tabela, registro_id) values (old.id, tg_table_name, old.id::text);
  elsif tg_table_name = 'membros' then
    insert into exclusoes (casa_id, tabela, registro_id) values (old.casa_id, tg_table_name, old.user_id::text);
  else
    insert into exclusoes (casa_id, tabela, registro_id) values (old.casa_id, tg_table_name, old.id::text);
  end if;
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['membros','categorias','cartoes','notas','nota_itens','gastos','contas_fixas','contas_pagamentos','faturas_pagas'] loop
    execute format('drop trigger if exists %I_exclusao on public.%I', t, t);
    execute format('create trigger %I_exclusao after delete on public.%I for each row execute function public.registrar_exclusao()', t, t);
  end loop;
end $$;

-- 3) tempo real também para notas (o resto já estava)
do $$
declare t text;
begin
  foreach t in array array['notas','nota_itens','faturas_pagas','exclusoes'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
