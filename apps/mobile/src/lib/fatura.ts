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
