-- Helpp Home Finance — v1
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Não mexe nas tabelas antigas da API (User, Receipt, Product...).

-- ============================================================
-- Tabelas
-- ============================================================

-- Uma "casa" = uma pessoa sozinha ou um casal. Todos os dados pertencem a uma casa.
create table if not exists public.casas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_convite text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.membros (
  casa_id uuid not null references public.casas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  primary key (casa_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  icone text not null default 'pricetag',
  cor text not null default '#64748B',
  ordem int not null default 0,
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists categorias_casa_idx on public.categorias(casa_id);

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  limite numeric(12,2) not null default 0,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  arquivado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cartoes_casa_idx on public.cartoes(casa_id);

-- Nota fiscal (NFC-e) lida pelo app. Os itens ficam em nota_itens.
create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  chave_acesso text not null,
  estabelecimento text,
  cnpj text,
  endereco text,
  total numeric(12,2),
  data_compra timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (casa_id, chave_acesso)
);

create table if not exists public.nota_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.notas(id) on delete cascade,
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  quantidade numeric(12,3) not null default 1,
  valor_unitario numeric(12,2),
  valor_total numeric(12,2) not null,
  categoria_id uuid references public.categorias(id) on delete set null
);
create index if not exists nota_itens_nota_idx on public.nota_itens(nota_id);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  descricao text,
  categoria_id uuid references public.categorias(id) on delete set null,
  forma_pagamento text not null default 'pix'
    check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito')),
  cartao_id uuid references public.cartoes(id) on delete set null,
  pago_por uuid references auth.users(id) on delete set null,
  nota_id uuid references public.notas(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (forma_pagamento <> 'credito' or cartao_id is not null)
);
create index if not exists gastos_casa_data_idx on public.gastos(casa_id, data desc);
create index if not exists gastos_cartao_idx on public.gastos(cartao_id);

create table if not exists public.contas_fixas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null,
  valor numeric(12,2),            -- null = valor varia todo mês (ex.: luz)
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  categoria_id uuid references public.categorias(id) on delete set null,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists contas_fixas_casa_idx on public.contas_fixas(casa_id);

-- Marca "paguei" de uma conta fixa em um mês. Gera também um gasto.
create table if not exists public.contas_pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_fixas(id) on delete cascade,
  casa_id uuid not null references public.casas(id) on delete cascade,
  competencia date not null,      -- sempre o dia 1 do mês
  valor numeric(12,2) not null,
  pago_em date not null default current_date,
  gasto_id uuid references public.gastos(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conta_id, competencia)
);

-- updated_at automático em gastos
create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists gastos_updated_at on public.gastos;
create trigger gastos_updated_at before update on public.gastos
  for each row execute function public.tocar_updated_at();

-- ============================================================
-- Segurança (RLS): cada um só vê os dados da própria casa
-- ============================================================

create or replace function public.sou_membro(p_casa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where casa_id = p_casa and user_id = auth.uid());
$$;

alter table public.casas enable row level security;
alter table public.membros enable row level security;
alter table public.categorias enable row level security;
alter table public.cartoes enable row level security;
alter table public.notas enable row level security;
alter table public.nota_itens enable row level security;
alter table public.gastos enable row level security;
alter table public.contas_fixas enable row level security;
alter table public.contas_pagamentos enable row level security;

drop policy if exists casas_ver on public.casas;
create policy casas_ver on public.casas for select to authenticated using (public.sou_membro(id));
drop policy if exists casas_editar on public.casas;
create policy casas_editar on public.casas for update to authenticated
  using (public.sou_membro(id)) with check (public.sou_membro(id));

drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select to authenticated using (public.sou_membro(casa_id));
drop policy if exists membros_editar_proprio on public.membros;
create policy membros_editar_proprio on public.membros for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists membros_sair on public.membros;
create policy membros_sair on public.membros for delete to authenticated using (user_id = auth.uid());

-- Tabelas de dados: membro da casa pode tudo
do $$
declare t text;
begin
  foreach t in array array['categorias','cartoes','notas','nota_itens','gastos','contas_fixas','contas_pagamentos'] loop
    execute format('drop policy if exists %I_membro on public.%I', t, t);
    execute format(
      'create policy %I_membro on public.%I for all to authenticated
         using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id))', t, t);
  end loop;
end $$;

-- ============================================================
-- Funções chamadas pelo app
-- ============================================================

-- Cria a casa do usuário + categorias padrão. Retorna o id da casa.
create or replace function public.criar_casa(p_nome_casa text, p_meu_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_casa uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa';
  end if;

  insert into casas (nome) values (p_nome_casa) returning id into v_casa;
  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), p_meu_nome);

  insert into categorias (casa_id, nome, icone, cor, ordem) values
    (v_casa, 'Mercado',     'cart',          '#16A34A', 1),
    (v_casa, 'Casa',        'home',          '#0EA5E9', 2),
    (v_casa, 'Contas',      'receipt',       '#6366F1', 3),
    (v_casa, 'Transporte',  'car',           '#F59E0B', 4),
    (v_casa, 'Saúde',       'medkit',        '#EF4444', 5),
    (v_casa, 'Lazer',       'game-controller','#A855F7', 6),
    (v_casa, 'Restaurante', 'restaurant',    '#F97316', 7),
    (v_casa, 'Pets',        'paw',           '#A16207', 8),
    (v_casa, 'Outros',      'ellipsis-horizontal', '#64748B', 9);

  return v_casa;
end $$;

-- Entra na casa do parceiro(a) pelo código de convite. Retorna o id da casa.
create or replace function public.entrar_na_casa(p_codigo text, p_meu_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_casa uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa';
  end if;

  select id into v_casa from casas where codigo_convite = upper(trim(p_codigo));
  if v_casa is null then raise exception 'Código de convite inválido'; end if;
  if (select count(*) from membros where casa_id = v_casa) >= 2 then
    raise exception 'Essa casa já tem 2 pessoas';
  end if;

  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), p_meu_nome);
  return v_casa;
end $$;

-- Gera um novo código de convite (invalida o anterior).
create or replace function public.novo_convite(p_casa uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_codigo text;
begin
  if not public.sou_membro(p_casa) then raise exception 'Sem permissão'; end if;
  v_codigo := upper(substr(md5(random()::text), 1, 6));
  update casas set codigo_convite = v_codigo where id = p_casa;
  return v_codigo;
end $$;

revoke execute on function public.criar_casa(text, text) from anon;
revoke execute on function public.entrar_na_casa(text, text) from anon;
revoke execute on function public.novo_convite(uuid) from anon;

-- ============================================================
-- Tempo real: os dois celulares atualizam sozinhos
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['gastos','cartoes','contas_fixas','contas_pagamentos','categorias','membros'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
