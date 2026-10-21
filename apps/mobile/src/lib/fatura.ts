import { dataDeISO, dataISO } from "./format";

/** Data com o dia limitado ao tamanho do mês (dia 31 em fevereiro vira 28/29). */
function diaNoMes(ano: number, mes: number, dia: number): Date {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(dia, ultimo));
}

/** Soma meses mantendo o dia (ajustado ao fim do mês quando precisa). */
export function somarMeses(iso: string, meses: number): string {
  const d = dataDeISO(iso);
  return dataISO(diaNoMes(d.getFullYear(), d.getMonth() + meses, d.getDate()));
}

/**
 * Em qual fatura cai uma compra no crédito. Regra usada pela maioria dos
 * bancos: compra no dia do fechamento ou depois vai para a fatura seguinte.
 * O vencimento é no mesmo mês do fechamento se o dia de vencimento for maior
 * que o de fechamento; senão, no mês seguinte.
 */
export function faturaDaCompra(dataCompra: string, diaFechamento: number, diaVencimento: number): { fechamento: string; vencimento: string } {
  const d = dataDeISO(dataCompra);
  let fech = diaNoMes(d.getFullYear(), d.getMonth(), diaFechamento);
  if (d >= fech) fech = diaNoMes(d.getFullYear(), d.getMonth() + 1, diaFechamento);
  const mesVenc = diaVencimento > diaFechamento ? fech.getMonth() : fech.getMonth() + 1;
  const venc = diaNoMes(fech.getFullYear(), mesVenc, diaVencimento);
  return { fechamento: dataISO(fech), vencimento: dataISO(venc) };
}

/** "10/11" a partir de YYYY-MM-DD. */
export function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Fatura seguinte/anterior a partir do fechamento (delta em meses). */
export function faturaVizinha(fechamento: string, delta: number, diaFechamento: number, diaVencimento: number): { fechamento: string; vencimento: string } {
  const d = dataDeISO(fechamento);
  const novoFech = dataISO(diaNoMes(d.getFullYear(), d.getMonth() + delta, diaFechamento));
  // um dia antes do fechamento cai nessa mesma fatura
  const vespera = dataDeISO(novoFech);
  vespera.setDate(vespera.getDate() - 1);
  return faturaDaCompra(dataISO(vespera), diaFechamento, diaVencimento);
}

export interface ResumoCartao {
  aberta: { fechamento: string; vencimento: string; total: number };
  /** Fatura que já fechou mas ainda não venceu (null se já venceu). `paga` = marcada como paga. */
  fechada: { fechamento: string; vencimento: string; total: number; paga: boolean } | null;
  /** Fatura aberta + fechada a vencer + parcelas/compras de faturas futuras. */
  limiteUsado: number;
  disponivel: number;
}

/** Junta os gastos de UM cartão nas faturas, a partir de hoje. */
/**
 * Mês (YYYY-MM) em que uma compra no cartão é paga: a data de pagamento que a
 * pessoa informou ou, se não tiver (importada do banco), o vencimento da fatura
 * em que a data da compra cai.
 */
export function mesPagamentoCartao(
  g: { data: string; data_pagamento?: string | null },
  cartao: { dia_fechamento: number; dia_vencimento: number },
): string {
  return (g.data_pagamento ?? faturaDaCompra(g.data, cartao.dia_fechamento, cartao.dia_vencimento).vencimento).slice(0, 7);
}

export function resumirCartao(
  gastos: { valor: number; data: string; data_pagamento?: string | null }[],
  cartao: { limite: number; dia_fechamento: number; dia_vencimento: number },
  hoje: string,
  /** Diz se a fatura com esse vencimento já foi marcada como paga. */
  estaPaga: (vencimento: string) => boolean = () => false,
): ResumoCartao {
  const aberta = faturaDaCompra(hoje, cartao.dia_fechamento, cartao.dia_vencimento);
  const anterior = faturaVizinha(aberta.fechamento, -1, cartao.dia_fechamento, cartao.dia_vencimento);
  let totalAberta = 0;
  let totalAnterior = 0;
  let futuras = 0;
  // Cada fatura é identificada pelo mês do vencimento (um vencimento por mês).
  const mesAberta = aberta.vencimento.slice(0, 7);
  const mesAnterior = anterior.vencimento.slice(0, 7);
  for (const g of gastos) {
    const m = mesPagamentoCartao(g, cartao);
    if (m === mesAberta) totalAberta += g.valor;
    else if (m === mesAnterior) totalAnterior += g.valor;
    else if (m > mesAberta) futuras += g.valor;
  }
  const fechadaAVencer = hoje <= anterior.vencimento && totalAnterior > 0;
  const paga = estaPaga(anterior.vencimento);
  // Fatura paga libera o limite.
  const limiteUsado = totalAberta + futuras + (fechadaAVencer && !paga ? totalAnterior : 0);
  return {
    aberta: { ...aberta, total: totalAberta },
    fechada: fechadaAVencer ? { ...anterior, total: totalAnterior, paga } : null,
    limiteUsado,
    disponivel: cartao.limite - limiteUsado,
  };
}
