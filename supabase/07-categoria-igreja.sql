-- Helpp Home Finance — categoria Igreja
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

-- Casas que já existem ganham a categoria (sem duplicar se rodar de novo).
insert into public.categorias (casa_id, nome, icone, cor, ordem)
select c.id, 'Igreja', 'church', '#7C3AED', 15
from public.casas c
where not exists (
  select 1 from public.categorias x where x.casa_id = c.id and x.icone = 'church'
);

-- Casas novas já nascem com ela.
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

  return v_casa;
end $$;
