import { useCallback, useEffect, useState } from "react";
import { useCasa } from "../casa/CasaContext";
import { faturaDaCompra, somarMeses } from "../lib/fatura";
import { limitesDoMes } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { Cartao, Categoria, ContaFixa, FaturaPaga, Gasto, PagamentoConta } from "./tipos";

/**
 * Busca uma lista da casa e mantém atualizada em tempo real: quando o outro
 * celular grava algo na mesma tabela, a lista recarrega sozinha.
 */
function useListaAoVivo<T>(tabela: string, buscar: (casaId: string) => PromiseLike<{ data: T[] | null }>, deps: unknown[]) {
  const { casa } = useCasa();
  const [itens, setItens] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    if (!casa) return;
    const { data } = await buscar(casa.id);
    setItens(data ?? []);
    setCarregando(false);
  }, [casa?.id, ...deps]);

  useEffect(() => {
    if (!casa) return;
    recarregar();
    const canal = supabase
      .channel(`${tabela}-${casa.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tabela, filter: `casa_id=eq.${casa.id}` }, () => recarregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [casa?.id, recarregar, tabela]);

  return { itens, carregando, recarregar };
}

export function useCategorias() {
  const { itens, ...resto } = useListaAoVivo<Categoria>(
    "categorias",
    (casaId) => supabase.from("categorias").select("id, nome, icone, cor, ordem").eq("casa_id", casaId).eq("arquivada", false).order("ordem"),
    [],
  );
  return { categorias: itens, ...resto };
}

export function useCartoes() {
  const { itens, ...resto } = useListaAoVivo<Cartao>(
    "cartoes",
    (casaId) =>
      supabase.from("cartoes").select("id, nome, limite, dia_fechamento, dia_vencimento").eq("casa_id", casaId).eq("arquivado", false).order("created_at"),
    [],
  );
  return { cartoes: itens.map((c) => ({ ...c, limite: Number(c.limite) })), ...resto };
}

/**
 * Mês em que o gasto "pesa" no orçamento: compra no cartão conta no mês em que
 * a FATURA VENCE (quando o dinheiro sai); o resto, no dia do gasto.
 */
export function mesDeReferencia(g: { data: string; cartao_id: string | null }, cartoes: Cartao[]): string {
  const c = g.cartao_id ? cartoes.find((x) => x.id === g.cartao_id) : undefined;
  if (!c) return g.data.slice(0, 7);
  return faturaDaCompra(g.data, c.dia_fechamento, c.dia_vencimento).vencimento.slice(0, 7);
}

/** Gastos que pesam num mês (mes = 0–11), mais recentes primeiro. Cartão = mês do vencimento da fatura. */
export function useGastosDoMes(ano: number, mes: number) {
  const { inicio, fim } = limitesDoMes(ano, mes);
  // Compras no cartão de até ~2 meses antes podem vencer neste mês.
  const desde = somarMeses(inicio, -2);
  const { cartoes } = useCartoes();
  const { itens, ...resto } = useListaAoVivo<Gasto>(
    "gastos",
    (casaId) =>
      supabase
        .from("gastos")
        // "*": inclui as colunas de parcela quando o SQL 03 já rodou, sem quebrar antes disso.
        .select("*")
        .eq("casa_id", casaId)
        .gte("data", desde)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
    [desde, fim],
  );
  const alvo = inicio.slice(0, 7);
  return {
    gastos: itens.filter((g) => mesDeReferencia(g, cartoes) === alvo).map((g) => ({ ...g, valor: Number(g.valor) })),
    ...resto,
  };
}

/** Últimos gastos lançados (para a tela inicial), independente do mês. */
export function useUltimosGastos(qtd: number) {
  const { itens, ...resto } = useListaAoVivo<Gasto>(
    "gastos",
    (casaId) => supabase.from("gastos").select("*").eq("casa_id", casaId).order("created_at", { ascending: false }).limit(qtd),
    [qtd],
  );
  return { ultimos: itens.map((g) => ({ ...g, valor: Number(g.valor) })), ...resto };
}

/**
 * Gastos no crédito de todos os cartões, de ~3 meses atrás em diante (inclui
 * parcelas futuras) — o suficiente para fatura aberta, fechada e limite usado.
 */
export function useGastosCredito(desde: string) {
  const { itens, ...resto } = useListaAoVivo<Gasto>(
    "gastos",
    (casaId) =>
      supabase
        .from("gastos")
        .select("*")
        .eq("casa_id", casaId)
        .not("cartao_id", "is", null)
        .gte("data", desde)
        .order("data", { ascending: false }),
    [desde],
  );
  return { gastosCredito: itens.map((g) => ({ ...g, valor: Number(g.valor) })), ...resto };
}

export function useContasFixas() {
  const { itens, ...resto } = useListaAoVivo<ContaFixa>(
    "contas_fixas",
    (casaId) => supabase.from("contas_fixas").select("id, nome, valor, dia_vencimento, categoria_id").eq("casa_id", casaId).eq("ativa", true).order("dia_vencimento"),
    [],
  );
  return { contas: itens.map((c) => ({ ...c, valor: c.valor == null ? null : Number(c.valor) })), ...resto };
}

/** Pagamentos das contas fixas de um mês (competencia = dia 1 do mês, YYYY-MM-01). */
export function usePagamentosDoMes(competencia: string) {
  const { itens, ...resto } = useListaAoVivo<PagamentoConta>(
    "contas_pagamentos",
    (casaId) => supabase.from("contas_pagamentos").select("id, conta_id, competencia, valor, pago_em, gasto_id").eq("casa_id", casaId).eq("competencia", competencia),
    [competencia],
  );
  return { pagamentos: itens.map((p) => ({ ...p, valor: Number(p.valor) })), ...resto };
}

/** Faturas marcadas como pagas (últimos meses). Sem o SQL 05, volta lista vazia. */
export function useFaturasPagas() {
  const { itens, ...resto } = useListaAoVivo<FaturaPaga>(
    "faturas_pagas",
    (casaId) => supabase.from("faturas_pagas").select("id, cartao_id, vencimento, valor, pago_em").eq("casa_id", casaId).order("vencimento", { ascending: false }).limit(200),
    [],
  );
  const pagas = new Set(itens.map((p) => `${p.cartao_id}|${p.vencimento}`));
  return { faturasPagas: itens, faturaPaga: (cartaoId: string, vencimento: string) => pagas.has(`${cartaoId}|${vencimento}`), ...resto };
}
