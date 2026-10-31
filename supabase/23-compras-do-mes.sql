-- Helpp — compras do mês: data da compra de cada item da lista e ligação com o item da nota fiscal
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

alter table public.lista_compras add column if not exists comprado_em date;
alter table public.lista_compras add column if not exists nota_item_id uuid;

-- Itens que já estavam marcados como comprados ficam com a data da última alteração.
update public.lista_compras
   set comprado_em = (updated_at at time zone 'America/Sao_Paulo')::date
 where comprado and comprado_em is null;
