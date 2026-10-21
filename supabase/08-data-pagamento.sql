-- Helpp Home Finance — data do pagamento
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.

-- Dia em que o dinheiro sai. Define o mês da despesa (e, no cartão, a fatura).
-- Vazio = calcula: compra no cartão → vencimento da fatura; resto → a própria data.
alter table public.gastos add column if not exists data_pagamento date;

-- Corrige o que já foi lançado À MÃO no cartão: a data que a pessoa digitou
-- era a data em que vai pagar. (Importados do banco e notas fiscais ficam como
-- estão: lá a data é a da compra. Parcelas criadas a partir de uma importação
-- também ficam de fora.)
update public.gastos g
set data_pagamento = g.data
where g.cartao_id is not null
  and g.data_pagamento is null
  and g.importacao_id is null
  and g.nota_id is null
  and not exists (
    select 1 from public.gastos s
    where g.parcelamento_id is not null
      and s.parcelamento_id = g.parcelamento_id
      and s.importacao_id is not null
  );
