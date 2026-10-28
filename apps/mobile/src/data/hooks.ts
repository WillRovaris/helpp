import { useCallback, useEffect, useMemo, useState } from "react";
import { useCasa } from "../casa/CasaContext";
import { mesPagamentoCartao, somarMeses } from "../lib/fatura";
import { hojeISO, limitesDoMes, somarDias as somarDiasISO } from "../lib/format";
import { competencia, contasComoDespesas, contasDoMes } from "../lib/contas";
import { mesAnterior as mesAnteriorISO, receitaNoMes, saldoAnterior } from "../lib/saldo";
import { alertasDeCategoria, alertasRepetidos } from "../lib/alertas";
import { detectarAssinaturas } from "../lib/assinaturas";
import { dividasDeContas, parcelamentosEmAberto } from "../lib/dividas";
import { agruparProdutos, type ItemNota, type NotaResumo } from "../lib/produtos";
import { gravarMeta, lerMeta, type Linha, linhas, ouvirMudancas, type Tabela } from "../offline/banco";
import { useSincronizacao } from "../offline/SincronizacaoContext";
import type { Caixinha, Cartao, Categoria, ContaFixa, FaturaPaga, Gasto, Importacao, ItemLista, MovimentoCaixinha, PagamentoConta, Receita, Sugestao } from "./tipos";
import { emojiCategoria } from "./tipos";

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
    (t) =>
      t
        .filter((c) => !c.arquivada)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((c) => ({ ...c, limite: c.limite == null ? null : Number(c.limite) })) as Categoria[],
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

function comoReceita(r: Linha): Receita {
  return { ...r, valor: Number(r.valor), recorrente: !!r.recorrente } as Receita;
}

/** Todas as entradas lançadas (avulsas e recorrentes). */
export function useReceitas() {
  const { itens, ...resto } = useTabela<Receita>("receitas", (t) => t.map(comoReceita).sort(porTexto("data")), []);
  return { receitas: itens, ...resto };
}

/** Entradas que valem no mês (mes = 0–11) e o total. */
export function useEntradasDoMes(ano: number, mes: number) {
  const { receitas, ...resto } = useReceitas();
  const alvo = competencia(ano, mes).slice(0, 7);
  const entradas = useMemo(() => receitas.filter((r) => receitaNoMes(r, alvo)), [receitas, alvo]);
  return { entradas, total: entradas.reduce((s, r) => s + r.valor, 0), ...resto };
}

/**
 * Sobra que vem do mês anterior para o mês (mes = 0–11): entradas − despesas (com contas fixas
 * não pagas) do mês anterior, mais a sobra que ele já tinha. Mês anterior sem entradas = zero.
 * `ajustado` = corrigido à mão.
 */
export function useSaldoAnterior(ano: number, mes: number) {
  const { casa } = useCasa();
  const calc = useCalculoMensal();
  const alvo = competencia(ano, mes).slice(0, 7);
  return useMemo(() => {
    const ajustes = casa?.saldos_iniciais ?? {};
    return { saldo: calc.saldoAnterior(alvo), ajustado: ajustes[alvo] != null, mes: alvo };
  }, [casa, calc, alvo]);
}

/**
 * Contas de qualquer mês (YYYY-MM), do mesmo jeito da tela inicial: entradas, despesas
 * (com contas fixas não pagas) e sobra que veio do mês anterior. Base do Balanço e do gráfico.
 */
export function useCalculoMensal() {
  const { casa } = useCasa();
  const { cartoes } = useCartoes();
  const { contas } = useContasFixas();
  const { receitas } = useReceitas();
  const { itens: gastos } = useTabela<Gasto>("gastos", (t) => t.map(comoGasto), []);
  const { itens: pagamentos } = useTabela<PagamentoConta>("contas_pagamentos", (t) => t.map((p) => ({ ...p, valor: Number(p.valor) })) as PagamentoConta[], []);

  return useMemo(() => {
    const ajustes = casa?.saldos_iniciais ?? {};
    const porMes = new Map<string, number>();
    for (const g of gastos) {
      const m = mesDeReferencia(g, cartoes);
      porMes.set(m, (porMes.get(m) ?? 0) + g.valor);
    }
    const entradasDoMes = (m: string) => receitas.filter((r) => receitaNoMes(r, m)).reduce((s, r) => s + r.valor, 0);
    const despesaDoMes = (m: string) => {
      const comp = `${m}-01`;
      // conta fixa só pesa a partir do mês em que foi cadastrada
      const vigentes = contas.filter((c) => !c.created_at || c.created_at.slice(0, 7) <= m);
      const abertas = contasComoDespesas(contasDoMes(vigentes, pagamentos.filter((p) => p.competencia === comp), comp, hojeISO()), comp);
      return (porMes.get(m) ?? 0) + abertas.reduce((s, g) => s + g.valor, 0);
    };
    return {
      entradasDoMes,
      despesaDoMes,
      saldoAnterior: (m: string) => saldoAnterior(m, entradasDoMes, despesaDoMes, ajustes),
    };
  }, [casa, cartoes, contas, receitas, gastos, pagamentos]);
}

/** Arquivos importados, mais recentes primeiro. */
export function useImportacoes() {
  const { itens, ...resto } = useTabela<Importacao>(
    "importacoes",
    (t) => t.sort(porTexto("created_at", true)).map((i) => ({ ...i, total: i.total == null ? null : Number(i.total) })) as Importacao[],
    [],
  );
  return { importacoes: itens, ...resto };
}

/**
 * Resumo de um mês (mes = 0–11) igual à tela inicial: despesas (com contas fixas não pagas),
 * entradas, sobra do mês anterior e quanto sobrou. Usado no fechamento do mês.
 */
export function useResumoDoMes(ano: number, mes: number) {
  const { gastos } = useGastosDoMes(ano, mes);
  const { contas } = useContasFixas();
  const comp = competencia(ano, mes);
  const { pagamentos } = usePagamentosDoMes(comp);
  const { entradas, total: totalEntradas } = useEntradasDoMes(ano, mes);
  const { saldo: saldoAnterior } = useSaldoAnterior(ano, mes);
  return useMemo(() => {
    const m = comp.slice(0, 7);
    // conta fixa só pesa a partir do mês em que foi cadastrada (igual à sobra do mês)
    const vigentes = contas.filter((c) => !c.created_at || c.created_at.slice(0, 7) <= m);
    const despesas = [...gastos, ...contasComoDespesas(contasDoMes(vigentes, pagamentos, comp, hojeISO()), comp)];
    const totalDespesas = Math.round(despesas.reduce((s, g) => s + g.valor, 0) * 100) / 100;
    const sobra = Math.round((totalEntradas + saldoAnterior - totalDespesas) * 100) / 100;
    return { despesas, totalDespesas, entradas, totalEntradas, saldoAnterior, sobra };
  }, [gastos, contas, pagamentos, comp, entradas, totalEntradas, saldoAnterior]);
}

/** Produtos comprados (itens das notas fiscais lidas), com preços por compra e por mercado. */
export function useProdutos() {
  const { itens: itensNota } = useTabela<ItemNota>("nota_itens", (t) => t as ItemNota[], []);
  const { itens: notas } = useTabela<NotaResumo>("notas", (t) => t as NotaResumo[], []);
  const produtos = useMemo(() => agruparProdutos(itensNota, notas), [itensNota, notas]);
  return { produtos, notas: notas.length };
}

/** Caixinhas ativas com quanto já tem guardado em cada uma, e os movimentos. */
export function useCaixinhas() {
  const { itens: caixinhas } = useTabela<Caixinha>(
    "caixinhas",
    (t) =>
      t
        .filter((c) => !c.arquivada)
        .sort(porTexto("created_at"))
        .map((c) => ({ ...c, meta: c.meta == null ? null : Number(c.meta) })) as Caixinha[],
    [],
  );
  const { itens: movimentos } = useTabela<MovimentoCaixinha>(
    "caixinha_movimentos",
    (t) => t.map((m) => ({ ...m, valor: Number(m.valor) })).sort((a, b) => porTexto("data", true)(a, b) || porTexto("created_at", true)(a, b)) as MovimentoCaixinha[],
    [],
  );
  const lista = useMemo(
    () => caixinhas.map((c) => ({ ...c, saldo: Math.round(movimentos.filter((m) => m.caixinha_id === c.id).reduce((s, m) => s + m.valor, 0) * 100) / 100 })),
    [caixinhas, movimentos],
  );
  return { caixinhas: lista, movimentos, totalGuardado: lista.reduce((s, c) => s + c.saldo, 0) };
}

/**
 * Alertas espertos do mês (categoria acima da média, cobrança repetida, assinaturas novas).
 * `fmt` formata valores (passe o `mostrarValor` do modo privacidade). O ✕ esconde cada um neste celular.
 */
export function useAlertas(fmt: (v: number) => string) {
  const { casa } = useCasa();
  const { cartoes } = useCartoes();
  const { categorias } = useCategorias();
  const { itens: gastos } = useTabela<Gasto>("gastos", (t) => t.map(comoGasto), []);
  const [versao, setVersao] = useState(0);

  const alertas = useMemo(() => {
    if (!casa) return [];
    const hoje = new Date();
    const mes = hojeISO().slice(0, 7);
    const porMes = new Map<string, Map<string, number>>();
    for (const g of gastos) {
      if (!g.categoria_id) continue;
      const m = mesDeReferencia(g, cartoes);
      const mapa = porMes.get(m) ?? new Map<string, number>();
      mapa.set(g.categoria_id, (mapa.get(g.categoria_id) ?? 0) + g.valor);
      porMes.set(m, mapa);
    }
    const anteriores: Map<string, number>[] = [];
    let m = mes;
    for (let i = 0; i < 3; i++) {
      m = mesAnteriorISO(m);
      const mapa = porMes.get(m);
      if (mapa && mapa.size) anteriores.push(mapa);
    }
    const nomes = new Map(categorias.map((c) => [c.id, { nome: c.nome, emoji: emojiCategoria(c.icone) }]));
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const lista = [
      ...alertasDeCategoria(mes, porMes.get(mes) ?? new Map(), anteriores, nomes, hoje.getDate(), diasNoMes, fmt),
      ...alertasRepetidos(gastos, somarDiasISO(hojeISO(), -30), fmt),
    ];
    return lista.filter((a) => !lerMeta(`alerta_visto:${casa.id}:${a.id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casa, cartoes, categorias, gastos, fmt, versao]);

  const dispensar = useCallback(
    (id: string) => {
      if (!casa) return;
      gravarMeta(`alerta_visto:${casa.id}:${id}`, "1");
      setVersao((v) => v + 1);
    },
    [casa],
  );
  return { alertas, dispensar };
}

/** Lista de compras da casa: pendentes primeiro (ordem em que foram adicionados), comprados no fim. */
export function useListaCompras() {
  const { itens } = useTabela<ItemLista>(
    "lista_compras",
    (t) =>
      t
        .map((i) => ({ ...i, quantidade: Number(i.quantidade) || 1, comprado: !!i.comprado }))
        .sort((a, b) => Number(a.comprado) - Number(b.comprado) || porTexto("created_at")(a, b)) as ItemLista[],
    [],
  );
  return { itens };
}

/** Cobranças que se repetem todo mês e ainda não são conta fixa (o "Não é assinatura" esconde neste celular). */
export function useAssinaturas() {
  const { casa } = useCasa();
  const { contas } = useContasFixas();
  const { itens: gastos } = useTabela<Gasto>("gastos", (t) => t.map(comoGasto), []);
  const [versao, setVersao] = useState(0);
  const assinaturas = useMemo(() => {
    if (!casa) return [];
    return detectarAssinaturas(gastos, contas.map((c) => c.nome), hojeISO()).filter((a) => !lerMeta(`assinatura_ignorada:${casa.id}:${a.chave}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casa, gastos, contas, versao]);
  const ignorar = useCallback(
    (chave: string) => {
      if (!casa) return;
      gravarMeta(`assinatura_ignorada:${casa.id}:${chave}`, "1");
      setVersao((v) => v + 1);
    },
    [casa],
  );
  return { assinaturas, ignorar };
}

/** Dívidas (contas fixas com prazo) e compras parceladas que ainda têm parcelas a pagar. */
export function useDividas() {
  const { contas } = useContasFixas();
  const { cartoes } = useCartoes();
  const { itens: gastos } = useTabela<Gasto>("gastos", (t) => t.filter((g) => g.parcelamento_id).map(comoGasto), []);
  const { itens: pagamentos } = useTabela<PagamentoConta>("contas_pagamentos", (t) => t as PagamentoConta[], []);
  return useMemo(() => {
    const porConta = new Map<string, number>();
    for (const p of pagamentos) porConta.set(p.conta_id, (porConta.get(p.conta_id) ?? 0) + 1);
    const dividas = dividasDeContas(contas, porConta);
    const parcelados = parcelamentosEmAberto(
      gastos.map((g) => ({ ...g, mes: mesDeReferencia(g, cartoes) })),
      hojeISO().slice(0, 7),
    );
    const total = dividas.reduce((s, d) => s + (d.valorRestante ?? 0), 0) + parcelados.reduce((s, p) => s + p.valorRestante, 0);
    return { dividas, parcelados, total };
  }, [contas, cartoes, gastos, pagamentos]);
}
