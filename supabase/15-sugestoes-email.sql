-- Helpp — sugestões vão para o e-mail do projeto (helppsuporte@gmail.com)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
--
-- A cada sugestão nova (de qualquer casa), a própria nuvem manda um e-mail pelo Resend
-- com o texto, nome e e-mail de quem mandou, a casa, a versão do app e o celular.
-- A chave do Resend fica guardada no cofre do Supabase (Vault) — ver o passo à parte
-- "guardar a chave" (não fica neste arquivo nem no código do app).
-- Sem a chave, nada é enviado e a sugestão é salva normalmente.

-- 1) dados extras da sugestão + situação (para a tela de resposta, mais adiante)
alter table public.sugestoes add column if not exists versao_app text;
alter table public.sugestoes add column if not exists dispositivo text;
alter table public.sugestoes add column if not exists status text not null default 'nova';
alter table public.sugestoes add column if not exists resposta text;

-- 2) envio de requisições pela internet a partir do banco
create extension if not exists pg_net;

create or replace function public.html_escapar(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>')
$$;

-- 3) e-mail a cada sugestão nova
create or replace function public.avisar_nova_sugestao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_chave text;
  v_email text;
  v_nome text;
  v_casa text;
  v_html text;
begin
  select decrypted_secret into v_chave from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_chave is null then
    return new; -- chave ainda não guardada: só salva a sugestão
  end if;

  select email into v_email from auth.users where id = new.created_by;
  select nome into v_nome from membros where user_id = new.created_by;
  select nome into v_casa from casas where id = new.casa_id;

  v_html := format(
    '<h2>💡 Nova sugestão no Helpp</h2>'
    '<p style="font-size:16px;line-height:1.5">%s</p><hr>'
    '<p style="color:#555"><b>De:</b> %s (%s)<br><b>Casa:</b> %s<br><b>Versão do app:</b> %s<br><b>Celular:</b> %s<br><b>Quando:</b> %s</p>',
    html_escapar(new.texto),
    html_escapar(coalesce(v_nome, '?')),
    html_escapar(coalesce(v_email, '?')),
    html_escapar(coalesce(v_casa, '?')),
    html_escapar(coalesce(new.versao_app, '?')),
    html_escapar(coalesce(new.dispositivo, '?')),
    to_char(new.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
  );

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_chave, 'Content-Type', 'application/json'),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', 'Helpp <onboarding@resend.dev>',
      'to', jsonb_build_array('helppsuporte@gmail.com'),
      'subject', '💡 Sugestão: ' || left(new.texto, 60),
      'html', v_html,
      'reply_to', v_email -- "Responder" no e-mail vai direto para quem sugeriu
    ))
  );
  return new;
exception when others then
  return new; -- problema no envio nunca impede de salvar a sugestão
end $$;

drop trigger if exists sugestoes_email on public.sugestoes;
create trigger sugestoes_email after insert on public.sugestoes
  for each row execute function public.avisar_nova_sugestao();
