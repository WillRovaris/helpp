import { useCallback, useEffect, useMemo, useState } from "react";
import { useCasa } from "../casa/CasaContext";
import { mesPagamentoCartao, somarMeses } from "../lib/fatura";
import { hojeISO, limitesDoMes } from "../lib/format";
import { competencia, contasComoDespesas, contasDoMes } from "../lib/contas";
import { saldoAnterior } from "../lib/saldo";
import { type Linha, linhas, ouvirMudancas, type Tabela } from "../offline/banco";
import { useSincronizacao } from "../offline/SincronizacaoContext";
import type { Cartao, Categoria, ContaFixa, FaturaPaga, Gasto, PagamentoConta, Sugestao } from "./tipos";

/**
 * Lista de uma tabela da casa, lida da cópia no celular (funciona sem internet).
 * Atualiza sozinha quando algo é gravado no celular ou chega da nuvem.
 * `recarregar` pede uma sincronização com a nuvem.
 */
function useTabela<T>(tabela: Tabela, selecionar: (todas: Linha[]) => T[], deps: unknown[]) {
  const { casa } = useCasa();
  const { sincronizarAgora } = useSincronizacao();
  const [versao, setVersao] = useState(0);

  useEffect(
    () =>
      ouvirMudancas((t) => {
        if (t === tabela) setVersao((v) => v + 1);
      }),
    [tabela],
  );

  const itens = useMemo(
    () => (casa ? selecionar(linhas(tabela).filter((l) => l.casa_id === casa.id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [casa?.id, versao, tabela, ...deps],
  );
  const recarregar = useCallback(() => sincronizarAgora(), [sincronizarAgora]);
  return { itens, carregando: false, recarregar };
}

const porTexto = (campo: string, desc = false) => (a: Linha, b: Linha) => {
  const x = String(a[campo] ?? "");
  const y = String(b[campo] ?? "");
  return desc ? (x < y ? 1 : x > y ? -1 : 0) : x < y ? -1 : x > y ? 1 : 0;
};

function comoGasto(g: Linha): Gasto {
  return { ...g, valor: Number(g.valor) } as Gasto;
}

export function useCategorias() {
  const { itens, ...resto } = useTabela<Categoria>(
    "categorias",
    (t) => t.filter((c) => !c.arquivada).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)) as Categoria[],
    [],
  );
  return { categorias: itens, ...resto };
}

export function useCartoes() {
  const { itens, ...resto } = useTabela<Cartao>(
    "cartoes",
    (t) => t.filter((c) => !c.arquivado).sort(porTexto("created_at")).map((c) => ({ ...c, limite: Number(c.limite) })) as Cartao[],
    [],
  );
  return { cartoes: itens, ...resto };
}

/**
 * Mês em que o gasto "pesa" no orçamento: compra no cartão conta no mês em que
 * a FATURA VENCE (quando o dinheiro sai); o resto, no dia do gasto.
 */
export function mesDeReferencia(g: { data: string; cartao_id: string | null; data_pagamento?: string | null }, cartoes: Cartao[]): string {
  // Data de pagamento informada pela pessoa manda sempre.
  if (g.data_pagamento) return g.data_pagamento.slice(0, 7);
  const c = g.cartao_id ? cartoes.find((x) => x.id === g.cartao_id) : undefined;
  if (!c) return g.data.slice(0, 7);
  return mesPagamentoCartao(g, c);
}

/** Gastos que pesam num mês (mes = 0–11), mais recentes primeiro. Cartão = mês do vencimento da fatura. */
export function useGastosDoMes(ano: number, mes: number) {
  const { inicio, fim } = limitesDoMes(ano, mes);
  const desde = somarMeses(inicio, -2); // compras no cartão de até ~2 meses antes podem vencer neste mês
  const alvo = inicio.slice(0, 7);
  const { cartoes } = useCartoes();
  const { itens, ...resto } = useTabela<Gasto>(
    "gastos",
    (t) =>
      t
        .filter((g) => g.data >= desde && g.data <= fim)
        .map(comoGasto)
        .filter((g) => mesDeReferencia(g, cartoes) === alvo)
        .sort((a, b) => porTexto("data", true)(a, b) || porTexto("created_at", true)(a, b)),
    [desde, fim, alvo, cartoes],
  );
  return { gastos: itens, ...resto };
}

/** Últimos gastos lançados (para a tela inicial), independente do mês. Parcelas de meses futuros ficam de fora. */
export function useUltimosGastos(qtd: number) {
  const hoje = hojeISO();
  const { itens, ...resto } = useTabela<Gasto>(
    "gastos",
    (t) =>
      t
        .filter((g) => g.data <= hoje || !g.parcelamento_id)
        .sort(porTexto("created_at", true))
        .slice(0, qtd)
        .map(comoGasto),
    [qtd, hoje],
  );
  return { ultimos: itens, ...resto };
}

/**
 * Gastos no crédito de todos os cartões, de ~3 meses atrás em diante (inclui
 * parcelas futuras) — o suficiente para fatura aberta, fechada e limite usado.
 */
export function useGastosCredito(desde: string) {
  const { itens, ...resto } = useTabela<Gasto>(
    "gastos",
    (t) => t.filter((g) => g.cartao_id && g.data >= desde).sort(porTexto("data", true)).map(comoGasto),
    [desde],
  );
  return { gastosCredito: itens, ...resto };
}

export function useContasFixas() {
  const { itens, ...resto } = useTabela<ContaFixa>(
    "contas_fixas",
    (t) =>
      t
        .filter((c) => c.ativa !== false)
        .sort((a, b) => a.dia_vencimento - b.dia_vencimento)
        .map((c) => ({ ...c, valor: c.valor == null ? null : Number(c.valor) })) as ContaFixa[],
    [],
  );
  return { contas: itens, ...resto };
}

/** Pagamentos das contas fixas de um mês (competencia = dia 1 do mês, YYYY-MM-01). */
export function usePagamentosDoMes(competencia: string) {
  const { itens, ...resto } = useTabela<PagamentoConta>(
    "contas_pagamentos",
    (t) => t.filter((p) => p.competencia === competencia).map((p) => ({ ...p, valor: Number(p.valor) })) as PagamentoConta[],
    [competencia],
  );
  return { pagamentos: itens, ...resto };
}

/** Faturas marcadas como pagas. */
export function useFaturasPagas() {
  const { itens, ...resto } = useTabela<FaturaPaga>("faturas_pagas", (t) => t.sort(porTexto("vencimento", true)) as FaturaPaga[], []);
  const pagas = new Set(itens.map((p) => `${p.cartao_id}|${p.vencimento}`));
  return { faturasPagas: itens, faturaPaga: (cartaoId: string, vencimento: string) => pagas.has(`${cartaoId}|${vencimento}`), ...resto };
}

/** Sugestões e melhorias da casa: pendentes primeiro, mais novas no topo. */
export function useSugestoes() {
  const { itens, ...resto } = useTabela<Sugestao>("sugestoes", (t) => t.sort(porTexto("created_at", true)) as Sugestao[], []);
  return { sugestoes: itens, pendentes: itens.filter((s) => !s.feita), feitas: itens.filter((s) => s.feita), ...resto };
}

/**
 * Saldo que vem do mês anterior para o mês (mes = 0–11): o que sobrou (renda − despesas,
 * incluindo contas fixas não pagas) passa sozinho para o mês seguinte. `ajustado` = corrigido à mão.
 */
export function useSaldoAnterior(ano: number, mes: number) {
  const { casa } = useCasa();
  const { cartoes } = useCartoes();
  const { contas } = useContasFixas();
  const { itens: gastos } = useTabela<Gasto>("gastos", (t) => t.map(comoGasto), []);
  const { itens: pagamentos } = useTabela<PagamentoConta>("contas_pagamentos", (t) => t.map((p) => ({ ...p, valor: Number(p.valor) })) as PagamentoConta[], []);
  const alvo = competencia(ano, mes).slice(0, 7);

  return useMemo(() => {
    const renda = casa?.renda_mensal ?? 0;
    const ajustes = casa?.saldos_iniciais ?? {};
    if (!casa || renda <= 0) return { saldo: 0, ajustado: false, mes: alvo };
    const porMes = new Map<string, number>();
    for (const g of gastos) {
      const m = mesDeReferencia(g, cartoes);
      porMes.set(m, (porMes.get(m) ?? 0) + g.valor);
    }
    // Começa no primeiro mês com despesa lançada (antes disso não há o que levar).
    const primeiroMes = porMes.size ? [...porMes.keys()].sort()[0] : null;
    const despesaDoMes = (m: string) => {
      const comp = `${m}-01`;
      // conta fixa só pesa a partir do mês em que foi cadastrada
      const vigentes = contas.filter((c) => !c.created_at || c.created_at.slice(0, 7) <= m);
      const abertas = contasComoDespesas(contasDoMes(vigentes, pagamentos.filter((p) => p.competencia === comp), comp, hojeISO()), comp);
      return (porMes.get(m) ?? 0) + abertas.reduce((s, g) => s + g.valor, 0);
    };
    return { saldo: saldoAnterior(alvo, renda, despesaDoMes, ajustes, primeiroMes), ajustado: ajustes[alvo] != null, mes: alvo };
  }, [casa, cartoes, contas, gastos, pagamentos, alvo]);
}
