-- Helpp — categorias principais com subcategorias + tipos de produto criados pela casa
-- Nenhuma despesa muda de lugar: cada uma continua na sua categoria, que agora pode estar dentro de uma principal.
-- Limite fica só na principal (o de uma categoria que virou subcategoria é somado ao da principal).
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run. Rodar de novo não duplica nada.

alter table public.categorias add column if not exists pai_id uuid references public.categorias(id) on delete set null;
create index if not exists categorias_pai_idx on public.categorias(pai_id);
alter table public.categorias drop constraint if exists categorias_pai_diferente;
alter table public.categorias add constraint categorias_pai_diferente check (pai_id is null or pai_id <> id);

-- A principal tem que ser da mesma casa.
drop trigger if exists categorias_mesma_casa on public.categorias;
create trigger categorias_mesma_casa before insert or update on public.categorias for each row
  execute function public.validar_mesma_casa('pai_id', 'categorias');

-- Coloca uma categoria dentro da principal: leva o limite para a principal e usa a cor dela.
create or replace function public.mover_para_categoria_principal(p_filha uuid, p_pai uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_limite numeric;
begin
  select limite into v_limite from categorias where id = p_filha;
  if coalesce(v_limite, 0) > 0 then
    update categorias set limite = coalesce(limite, 0) + v_limite where id = p_pai;
  end if;
  update categorias set pai_id = p_pai, limite = null, cor = (select cor from categorias where id = p_pai)
  where id = p_filha;
end $$;

-- Monta as principais e as subcategorias de uma casa.
create or replace function public.organizar_categorias(p_casa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_lazer uuid;
  v_pai uuid;
  v_cor text;
  v_filha uuid;
  v_achada record;
begin
  -- Os nomes só mudam se ainda forem os do padrão (o que a pessoa renomeou fica como está).
  update categorias set nome = 'Carro' where casa_id = p_casa and icone = 'car' and nome = 'Transporte';
  update categorias set nome = 'Lanches e restaurantes' where casa_id = p_casa and icone = 'restaurant' and nome = 'Restaurante';
  update categorias set nome = 'Empréstimos' where casa_id = p_casa and icone = 'cash' and nome = 'Empréstimo';

  select id into v_lazer from categorias where casa_id = p_casa and lower(nome) = 'lazer e pessoal' limit 1;
  if v_lazer is null then
    insert into categorias (casa_id, nome, icone, cor, ordem) values (p_casa, 'Lazer e pessoal', '🎉', '#A855F7', 6)
    returning id into v_lazer;
  end if;

  -- Categorias que já existem e viram subcategoria.
  for r in select * from (values
    ('home', 'receipt'),
    ('lazer', 'game-controller'),
    ('lazer', 'shirt'),
    ('lazer', 'gift'),
    ('lazer', 'airplane')
  ) as t(pai, filha) loop
    if r.pai = 'lazer' then v_pai := v_lazer;
    else select id into v_pai from categorias where casa_id = p_casa and icone = r.pai and not arquivada order by ordem limit 1;
    end if;
    continue when v_pai is null;
    for v_filha in select id from categorias where casa_id = p_casa and icone = r.filha and not arquivada and pai_id is null and id <> v_pai loop
      perform mover_para_categoria_principal(v_filha, v_pai);
    end loop;
  end loop;

  -- Subcategorias novas. Se a casa já tem uma com o mesmo nome, ela entra na principal em vez de duplicar.
  for r in select * from (values
    ('home', 'Internet e telefone', '🌐', 1),
    ('home', 'Água e luz', '💡', 2),
    ('home', 'Aluguel ou condomínio', '🏢', 3),
    ('home', 'Manutenção da casa', '🔧', 4),
    ('home', 'Assinaturas', '🔁', 5),
    ('car', 'Combustível', '⛽', 1),
    ('car', 'Manutenção do carro', '🛠️', 2),
    ('car', 'Impostos do carro', '📄', 3),
    ('car', 'Seguro do carro', '🛡️', 4),
    ('school', 'Mensalidade', '🎓', 1),
    ('school', 'Material escolar', '📚', 2),
    ('school', 'Presentes da escola', '🎁', 3),
    ('school', 'Pagamentos extras', '💵', 4),
    ('restaurant', 'Restaurante', '🍽️', 1),
    ('restaurant', 'Lanchonete', '🍔', 2),
    ('restaurant', 'Cafezinho', '☕', 3),
    ('restaurant', 'Sobremesas', '🍰', 4),
    ('cash', 'Banco', '🏦', 1),
    ('cash', 'Financiamento', '📋', 2),
    ('cash', 'Cartão parcelado', '💳', 3),
    ('medkit', 'Farmácia', '💊', 1),
    ('medkit', 'Suplementos', '💪', 2),
    ('medkit', 'Consultas', '🩺', 3),
    ('medkit', 'Estética', '💄', 4)
  ) as t(pai, nome, emoji, ordem) loop
    select id, cor into v_pai, v_cor from categorias where casa_id = p_casa and icone = r.pai and not arquivada order by ordem limit 1;
    continue when v_pai is null; -- a pessoa excluiu a principal: respeita

    v_achada := null;
    select id, pai_id, arquivada into v_achada from categorias
    where casa_id = p_casa and lower(nome) = lower(r.nome) and id <> v_pai
    order by arquivada limit 1;

    if v_achada.id is null then
      insert into categorias (casa_id, nome, icone, cor, ordem, pai_id) values (p_casa, r.nome, r.emoji, v_cor, r.ordem, v_pai);
    elsif not v_achada.arquivada and v_achada.pai_id is null then
      perform mover_para_categoria_principal(v_achada.id, v_pai);
    end if;
  end loop;
end $$;

revoke execute on function public.mover_para_categoria_principal(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.organizar_categorias(uuid) from public, anon, authenticated;

-- Casas que já existem.
do $$
declare c record;
begin
  for c in select id from public.casas loop
    perform public.organizar_categorias(c.id);
  end loop;
end $$;

-- Casas novas já nascem organizadas.
create or replace function public.criar_casa(p_nome_casa text, p_meu_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_casa uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa';
  end if;

  insert into casas (nome) values (left(coalesce(nullif(trim(p_nome_casa), ''), 'Minha casa'), 60)) returning id into v_casa;
  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), left(coalesce(nullif(trim(p_meu_nome), ''), 'Eu'), 60));

  insert into categorias (casa_id, nome, icone, cor, ordem) values
    (v_casa, 'Mercado',     'cart',                '#16A34A', 1),
    (v_casa, 'Casa',        'home',                '#0EA5E9', 2),
    (v_casa, 'Contas',      'receipt',             '#6366F1', 3),
    (v_casa, 'Transporte',  'car',                 '#F59E0B', 4),
    (v_casa, 'Saúde',       'medkit',              '#EF4444', 5),
    (v_casa, 'Lazer',       'game-controller',     '#A855F7', 6),
    (v_casa, 'Restaurante', 'restaurant',          '#F97316', 7),
    (v_casa, 'Pets',        'paw',                 '#A16207', 8),
    (v_casa, 'Escola',      'school',              '#2563EB', 10),
    (v_casa, 'Vestuário',   'shirt',               '#DB2777', 11),
    (v_casa, 'Presente',    'gift',                '#E11D48', 12),
    (v_casa, 'Viagem',      'airplane',            '#0891B2', 13),
    (v_casa, 'Empréstimo',  'cash',                '#0F766E', 14),
    (v_casa, 'Igreja',      'church',              '#7C3AED', 15),
    (v_casa, 'Outros',      'ellipsis-horizontal', '#64748B', 99);

  perform organizar_categorias(v_casa);
  return v_casa;
end $$;

-- Tipos de produto criados pela casa ("+ Novo tipo" em O que mais compramos).
create table if not exists public.produto_tipos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  emoji text not null default '🛍️' check (char_length(emoji) <= 16),
  alimento boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists produto_tipos_casa_idx on public.produto_tipos(casa_id);
create index if not exists produto_tipos_updated_at_idx on public.produto_tipos(updated_at);

alter table public.produto_tipos enable row level security;
drop policy if exists produto_tipos_membro on public.produto_tipos;
create policy produto_tipos_membro on public.produto_tipos for all to authenticated
  using (public.sou_membro(casa_id)) with check (public.sou_membro(casa_id));

drop trigger if exists produto_tipos_updated_at on public.produto_tipos;
create trigger produto_tipos_updated_at before update on public.produto_tipos
  for each row execute function public.tocar_updated_at();
drop trigger if exists produto_tipos_exclusao on public.produto_tipos;
create trigger produto_tipos_exclusao after delete on public.produto_tipos
  for each row execute function public.registrar_exclusao();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'produto_tipos'
  ) then
    alter publication supabase_realtime add table public.produto_tipos;
  end if;
end $$;
