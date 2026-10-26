-- Helpp — reforço de segurança (auditoria de 26/10/2026)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- Regra: o banco é quem garante a segurança; o app pode ser modificado por um atacante.
--  1) Convite: código longo, gerado só quando pedido, vence em 48 h, vale uma vez e
--     tem limite de tentativas (antes: 6 letras fixas para sempre → dava para "chutar").
--  2) Ninguém troca a própria casa nem o próprio usuário pelo cadastro de membro.
--  3) "Quem criou" (created_by) é sempre a pessoa logada, não o que o app mandar.
--  4) Um lançamento só pode apontar para cartão/categoria/nota/conta/pessoa da MESMA casa.
--  5) Sugestões: no máximo 20 por dia e 2000 letras (evita spam de e-mail).
--  6) Funções do banco: quem não está logado não executa nenhuma.
--  7) Tabelas antigas do app de preços: bloqueadas para o app (nenhum dado é apagado).
--  8) Contatos: o e-mail é sempre o da conta (não dá para gravar o e-mail de outra pessoa).

-- ------------------------------------------------------------------ 1) convites
alter table public.casas alter column codigo_convite drop default;
alter table public.casas alter column codigo_convite drop not null;
alter table public.casas add column if not exists convite_expira_em timestamptz;
-- invalida todos os códigos antigos (curtos e sem validade)
update public.casas set codigo_convite = null, convite_expira_em = null;

-- 8 caracteres de um alfabeto sem letras confusas (sem I, O, 0, 1): 32^8 ≈ 1 trilhão de códigos
create or replace function public.gerar_codigo_convite() returns text
language plpgsql volatile set search_path = public as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  r text := '';
  i int;
begin
  for i in 0..7 loop
    r := r || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return r;
end $$;

create table if not exists public.convite_tentativas (
  user_id uuid not null,
  em timestamptz not null default now()
);
create index if not exists convite_tentativas_idx on public.convite_tentativas(user_id, em);
alter table public.convite_tentativas enable row level security; -- sem policy: ninguém lê/escreve pelo app

-- uma pessoa = uma casa (impede entrar em duas ao mesmo tempo)
create unique index if not exists membros_um_por_usuario on public.membros(user_id);

create or replace function public.novo_convite(p_casa uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_codigo text;
begin
  if auth.uid() is null or not public.sou_membro(p_casa) then raise exception 'Sem permissão'; end if;
  if (select count(*) from membros where casa_id = p_casa) >= 2 then raise exception 'Essa casa já tem 2 pessoas'; end if;
  v_codigo := public.gerar_codigo_convite();
  update casas set codigo_convite = v_codigo, convite_expira_em = now() + interval '48 hours' where id = p_casa;
  return v_codigo;
end $$;

-- Código inválido/vencido devolve NULL (e não erro) para a tentativa ficar registrada.
create or replace function public.entrar_na_casa(p_codigo text, p_meu_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_casa uuid;
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then raise exception 'Você já participa de uma casa'; end if;
  if (select count(*) from convite_tentativas where user_id = auth.uid() and em > now() - interval '1 hour') >= 5 then
    raise exception 'Muitas tentativas. Espere uma hora e tente de novo.';
  end if;
  insert into convite_tentativas (user_id) values (auth.uid());

  select id into v_casa from casas
   where codigo_convite = v_codigo and convite_expira_em > now()
   for update;
  if v_casa is null then return null; end if;
  if (select count(*) from membros where casa_id = v_casa) >= 2 then raise exception 'Essa casa já tem 2 pessoas'; end if;

  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), left(coalesce(nullif(trim(p_meu_nome), ''), 'Eu'), 60));
  update casas set codigo_convite = null, convite_expira_em = null where id = v_casa; -- convite vale uma vez
  return v_casa;
end $$;

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

  return v_casa;
end $$;

-- Pelo app (papel "authenticated"), casa e código de convite só mudam pelas funções acima.
create or replace function public.proteger_casa() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id
       or new.codigo_convite is distinct from old.codigo_convite
       or new.convite_expira_em is distinct from old.convite_expira_em then
      raise exception 'Alteração não permitida';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists casas_proteger on public.casas;
create trigger casas_proteger before update on public.casas
  for each row execute function public.proteger_casa();

-- ------------------------------------------------------------------ 2) membros
create or replace function public.proteger_membro() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.casa_id is distinct from old.casa_id or new.user_id is distinct from old.user_id) then
    raise exception 'Alteração não permitida';
  end if;
  return new;
end $$;
drop trigger if exists membros_proteger on public.membros;
create trigger membros_proteger before update on public.membros
  for each row execute function public.proteger_membro();

-- ------------------------------------------------------------------ 3) created_by
create or replace function public.forcar_autor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['notas','gastos','sugestoes','receitas','importacoes'] loop
    execute format('drop trigger if exists %I_autor on public.%I', t, t);
    execute format('create trigger %I_autor before insert or update on public.%I for each row execute function public.forcar_autor()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ 4) referências da mesma casa
-- Argumentos em pares: coluna, tabela ('membros' = pessoa da casa). Só confere o que mudou.
create or replace function public.validar_mesma_casa() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  i int;
  col text;
  tab text;
  v text;
  achou uuid;
  novo jsonb := to_jsonb(new);
  antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  for i in 0 .. (tg_nargs / 2 - 1) loop
    col := tg_argv[i * 2];
    tab := tg_argv[i * 2 + 1];
    v := novo ->> col;
    continue when v is null;
    continue when tg_op = 'UPDATE' and (antigo ->> col) is not distinct from v;
    if tab = 'membros' then
      if not exists (select 1 from membros where user_id = v::uuid and casa_id = new.casa_id) then
        raise exception 'Referência inválida: %', col;
      end if;
    else
      execute format('select casa_id from public.%I where id = $1', tab) into achou using v::uuid;
      if achou is distinct from new.casa_id then
        raise exception 'Referência inválida: %', col;
      end if;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists gastos_mesma_casa on public.gastos;
create trigger gastos_mesma_casa before insert or update on public.gastos for each row
  execute function public.validar_mesma_casa('categoria_id', 'categorias', 'cartao_id', 'cartoes', 'nota_id', 'notas', 'pago_por', 'membros');
drop trigger if exists nota_itens_mesma_casa on public.nota_itens;
create trigger nota_itens_mesma_casa before insert or update on public.nota_itens for each row
  execute function public.validar_mesma_casa('nota_id', 'notas');
drop trigger if exists contas_fixas_mesma_casa on public.contas_fixas;
create trigger contas_fixas_mesma_casa before insert or update on public.contas_fixas for each row
  execute function public.validar_mesma_casa('categoria_id', 'categorias', 'pago_por', 'membros');
drop trigger if exists contas_pagamentos_mesma_casa on public.contas_pagamentos;
create trigger contas_pagamentos_mesma_casa before insert or update on public.contas_pagamentos for each row
  execute function public.validar_mesma_casa('conta_id', 'contas_fixas', 'gasto_id', 'gastos');
drop trigger if exists faturas_pagas_mesma_casa on public.faturas_pagas;
create trigger faturas_pagas_mesma_casa before insert or update on public.faturas_pagas for each row
  execute function public.validar_mesma_casa('cartao_id', 'cartoes');
drop trigger if exists importacoes_mesma_casa on public.importacoes;
create trigger importacoes_mesma_casa before insert or update on public.importacoes for each row
  execute function public.validar_mesma_casa('cartao_id', 'cartoes');
drop trigger if exists receitas_mesma_casa on public.receitas;
create trigger receitas_mesma_casa before insert or update on public.receitas for each row
  execute function public.validar_mesma_casa('recebido_por', 'membros');

-- ------------------------------------------------------------------ 5) sugestões
create or replace function public.limitar_sugestoes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(new.texto, '')) > 2000 then raise exception 'Sugestão muito longa (máximo 2000 letras)'; end if;
  if current_user in ('authenticated', 'anon') then
    new.created_at := now(); -- data vem do servidor (não dá para "voltar no tempo" e driblar o limite)
    if (select count(*) from sugestoes where created_by = auth.uid() and created_at > now() - interval '1 day') >= 20 then
      raise exception 'Limite de 20 sugestões por dia. Tente amanhã.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sugestoes_limite on public.sugestoes;
create trigger sugestoes_limite before insert on public.sugestoes
  for each row execute function public.limitar_sugestoes();

-- ------------------------------------------------------------------ 6) funções
-- Quem não está logado não executa nenhuma função; o app (logado) só precisa destas.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.sou_membro(uuid) to authenticated;
grant execute on function public.criar_casa(text, text) to authenticated;
grant execute on function public.entrar_na_casa(text, text) to authenticated;
grant execute on function public.novo_convite(uuid) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ------------------------------------------------------------------ 7) tabelas antigas
-- O app de preços antigo (Prisma) não usa o Supabase pelo app: bloqueia o acesso direto.
-- Os dados continuam lá, intactos.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('casas', 'membros', 'categorias', 'cartoes', 'notas', 'nota_itens', 'gastos', 'contas_fixas',
                            'contas_pagamentos', 'faturas_pagas', 'exclusoes', 'sugestoes', 'receitas', 'importacoes',
                            'contatos', 'convite_tentativas')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------------ 8) contatos
create or replace function public.contato_email_da_conta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := (select email from auth.users where id = new.user_id);
  return new;
end $$;
drop trigger if exists contatos_email on public.contatos;
create trigger contatos_email before insert or update on public.contatos
  for each row execute function public.contato_email_da_conta();
