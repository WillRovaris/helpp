// Dívidas e parcelamentos: quanto ainda falta pagar e quando termina.
//  - contas fixas com prazo (empréstimo, plano em 12x...) → parcelas pagas × total;
//  - compras parceladas (mesmo parcelamento_id) → parcelas que ainda vão cair.

const somarMesesComp = (comp: string, n: number) => {
  const d = new Date(Number(comp.slice(0, 4)), Number(comp.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export interface DividaConta {
  id: string;
  nome: string;
  valorParcela: number | null;
  total: number;
  pagas: number;
  restantes: number;
  valorRestante: number | null;
  /** YYYY-MM da última parcela. */
  termina: string;
}

export function dividasDeContas(
  contas: { id: string; nome: string; valor: number | null; inicio?: string | null; meses?: number | null }[],
  pagamentosPorConta: Map<string, number>,
): DividaConta[] {
  return contas
    .filter((c) => c.meses && c.inicio)
    .map((c) => {
      const total = c.meses!;
      const pagas = Math.min(total, pagamentosPorConta.get(c.id) ?? 0);
      const restantes = total - pagas;
      return {
        id: c.id,
        nome: c.nome,
        valorParcela: c.valor,
        total,
        pagas,
        restantes,
        valorRestante: c.valor != null ? Math.round(c.valor * restantes * 100) / 100 : null,
        termina: somarMesesComp(c.inicio!.slice(0, 7), total - 1),
      };
    })
    .filter((d) => d.restantes > 0)
    .sort((a, b) => (a.termina < b.termina ? -1 : 1));
}

export interface Parcelamento {
  id: string;
  descricao: string;
  cartaoId: string | null;
  total: number;
  restantes: number;
  valorRestante: number;
  termina: string;
}

/**
 * @param gastos parcelas lançadas, já com o mês em que cada uma é paga (`mes`, YYYY-MM)
 * @param mesAtual parcelas deste mês em diante ainda contam como "falta pagar"
 */
export function parcelamentosEmAberto(
  gastos: { parcelamento_id?: string | null; parcelas?: number | null; descricao: string | null; cartao_id: string | null; valor: number; mes: string }[],
  mesAtual: string,
): Parcelamento[] {
  const grupos = new Map<string, typeof gastos>();
  for (const g of gastos) {
    if (!g.parcelamento_id || !g.parcelas || g.parcelas < 2) continue;
    grupos.set(g.parcelamento_id, [...(grupos.get(g.parcelamento_id) ?? []), g]);
  }
  const lista: Parcelamento[] = [];
  for (const [id, gs] of grupos) {
    const futuras = gs.filter((g) => g.mes >= mesAtual);
    if (!futuras.length) continue;
    lista.push({
      id,
      descricao: gs[0].descricao ?? "Compra parcelada",
      cartaoId: gs[0].cartao_id,
      total: gs[0].parcelas!,
      restantes: futuras.length,
      valorRestante: Math.round(futuras.reduce((s, g) => s + g.valor, 0) * 100) / 100,
      termina: gs.map((g) => g.mes).sort().reverse()[0],
    });
  }
  return lista.sort((a, b) => b.valorRestante - a.valorRestante);
}
