-- Helpp — Sugestões recebidas (tela do dono do app, com as sugestões de TODAS as casas)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run. Pode rodar de novo sem problema.
--
-- 1) sou_admin(): só as contas do dono (franck.will@gmail.com e helppsuporte@gmail.com).
-- 2) sugestoes_recebidas(): lista de todas as casas — só para o admin.
-- 3) responder_sugestao(): muda a situação e escreve a resposta — só para o admin.
-- 4) Quem não é admin não consegue mudar situação nem resposta (nem pelo app, nem por fora).
-- A pessoa que sugeriu vê a situação e a resposta na tela de Sugestões da casa dela.

-- ------------------------------------------------------------------ 1) quem é admin
create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) in ('franck.will@gmail.com', 'helppsuporte@gmail.com')
  );
$$;

-- ------------------------------------------------------------------ 2) lista de todas as casas
create or replace function public.sugestoes_recebidas()
returns table (
  id uuid, texto text, status text, resposta text, feita boolean, created_at timestamptz,
  versao_app text, dispositivo text, casa_nome text, autor_nome text, autor_email text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.sou_admin() then
    raise exception 'Só a equipe do Helpp pode ver as sugestões de todas as casas.';
  end if;
  return query
    select s.id, s.texto, s.status, s.resposta, s.feita, s.created_at, s.versao_app, s.dispositivo,
           c.nome, m.nome, u.email::text
    from public.sugestoes s
    join public.casas c on c.id = s.casa_id
    left join public.membros m on m.casa_id = s.casa_id and m.user_id = s.created_by
    left join auth.users u on u.id = s.created_by
    order by s.created_at desc
    limit 500;
end $$;

-- ------------------------------------------------------------------ 3) responder
create or replace function public.responder_sugestao(p_id uuid, p_status text, p_resposta text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then
    raise exception 'Só a equipe do Helpp pode responder sugestões.';
  end if;
  if p_status not in ('nova', 'analisando', 'planejada', 'feita', 'recusada') then
    raise exception 'Situação inválida: %', p_status;
  end if;
  update public.sugestoes set
    status = p_status,
    resposta = nullif(left(trim(coalesce(p_resposta, '')), 2000), ''),
    feita = case when p_status = 'feita' then true else feita end,
    feita_em = case when p_status = 'feita' then coalesce(feita_em, now()) else feita_em end
  where id = p_id;
end $$;

-- ------------------------------------------------------------------ 4) proteger situação e resposta
create or replace function public.proteger_resposta_sugestao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.sou_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'nova';
    new.resposta := null;
  else
    new.status := old.status;
    new.resposta := old.resposta;
  end if;
  return new;
end $$;

drop trigger if exists sugestoes_proteger_resposta on public.sugestoes;
create trigger sugestoes_proteger_resposta before insert or update on public.sugestoes
  for each row execute function public.proteger_resposta_sugestao();

-- ------------------------------------------------------------------ permissões (mesmo padrão do SQL 20)
revoke all on function public.sou_admin() from public, anon;
revoke all on function public.sugestoes_recebidas() from public, anon;
revoke all on function public.responder_sugestao(uuid, text, text) from public, anon;
revoke all on function public.proteger_resposta_sugestao() from public, anon, authenticated;
grant execute on function public.sou_admin() to authenticated;
grant execute on function public.sugestoes_recebidas() to authenticated;
grant execute on function public.responder_sugestao(uuid, text, text) to authenticated;
