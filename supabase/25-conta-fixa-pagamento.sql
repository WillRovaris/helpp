-- Helpp — conta fixa com forma de pagamento, cartão e ícone próprio (ex.: 📱 na conta de celular)
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

alter table public.contas_fixas add column if not exists forma_pagamento text;
alter table public.contas_fixas add column if not exists cartao_id uuid references public.cartoes(id) on delete set null;
alter table public.contas_fixas add column if not exists icone text;

alter table public.contas_fixas drop constraint if exists contas_fixas_forma_valida;
alter table public.contas_fixas add constraint contas_fixas_forma_valida
  check (forma_pagamento is null or forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito'));
alter table public.contas_fixas drop constraint if exists contas_fixas_icone_curto;
alter table public.contas_fixas add constraint contas_fixas_icone_curto
  check (icone is null or char_length(icone) <= 16);

-- O cartão da conta também tem que ser da mesma casa.
drop trigger if exists contas_fixas_mesma_casa on public.contas_fixas;
create trigger contas_fixas_mesma_casa before insert or update on public.contas_fixas for each row
  execute function public.validar_mesma_casa('categoria_id', 'categorias', 'pago_por', 'membros', 'cartao_id', 'cartoes');
