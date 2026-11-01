import { idsDaFamilia } from "../lib/categorias";
import { contasComoDespesas, contasDoMes } from "../lib/contas";
import { hojeISO } from "../lib/format";
import { linhas } from "../offline/banco";
import { mesDeReferencia } from "./hooks";
import type { Cartao, Categoria, ContaFixa, PagamentoConta } from "./tipos";

/**
 * Quanto a categoria (com as subcategorias dela) já tem no mês (YYYY-MM), do mesmo jeito que a tela
 * inicial soma: despesas do mês + contas fixas ainda não pagas. Lê a cópia do celular (funciona sem internet).
 */
export function totalDaCategoriaNoMes(casaId: string, categoriaId: string, mes: string): number {
  const familia = idsDaFamilia(categoriaId, linhas("categorias").filter((c) => c.casa_id === casaId) as Categoria[]);
  const cartoes = linhas("cartoes").filter((c) => c.casa_id === casaId) as Cartao[];
  const gastos = linhas("gastos")
    .filter((g) => g.casa_id === casaId && familia.has(g.categoria_id))
    .filter((g) => mesDeReferencia({ data: g.data, cartao_id: g.cartao_id, data_pagamento: g.data_pagamento }, cartoes) === mes)
    .reduce((s, g) => s + Number(g.valor), 0);
  const comp = `${mes}-01`;
  const contas = linhas("contas_fixas")
    .filter((c) => c.casa_id === casaId && c.ativa !== false && familia.has(c.categoria_id))
    .map((c) => ({ ...c, valor: c.valor == null ? null : Number(c.valor) })) as ContaFixa[];
  const pagamentos = linhas("contas_pagamentos")
    .filter((p) => p.casa_id === casaId && p.competencia === comp)
    .map((p) => ({ ...p, valor: Number(p.valor) })) as PagamentoConta[];
  const abertas = contasComoDespesas(contasDoMes(contas, pagamentos, comp, hojeISO()), comp);
  return Math.round((gastos + abertas.reduce((s, g) => s + g.valor, 0)) * 100) / 100;
}
