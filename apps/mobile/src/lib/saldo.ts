// Entradas do mês e saldo que passa de um mês para o outro (pedido do dono):
//   sobra do mês anterior = sobra que ele recebeu + entradas dele − despesas dele
// Se o mês anterior não teve nenhuma entrada lançada, não passa nada (saldo zero).
// A pessoa pode corrigir a sobra de um mês à mão (ajuste); a conta continua dali em diante.

/** "2026-10" → "2026-09". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** A entrada vale no mês (YYYY-MM)? Recorrente: do mês da data até `ate`; senão, só no mês da data. */
export function receitaNoMes(r: { data: string; recorrente?: boolean | null; ate?: string | null }, mes: string): boolean {
  const inicio = r.data.slice(0, 7);
  if (!r.recorrente) return inicio === mes;
  return inicio <= mes && (!r.ate || mes <= r.ate);
}

/**
 * Sobra que vem do mês anterior para `mes` (YYYY-MM).
 * @param entradasDoMes total de entradas de um mês
 * @param despesaDoMes total de despesas de um mês
 * @param ajustes sobras corrigidas à mão (mês que recebe → valor)
 */
export function saldoAnterior(
  mes: string,
  entradasDoMes: (mes: string) => number,
  despesaDoMes: (mes: string) => number,
  ajustes: Record<string, number>,
): number {
  // Volta mês a mês até achar um ajuste ou um mês anterior sem entradas; depois soma para frente.
  const caminho: string[] = [];
  let m = mes;
  let saldo = 0;
  for (let i = 0; i < 36; i++) {
    if (ajustes[m] != null) {
      saldo = ajustes[m];
      break;
    }
    const ant = mesAnterior(m);
    if (entradasDoMes(ant) <= 0 && ajustes[ant] == null) break; // mês anterior zerado: não leva nada
    caminho.push(m);
    m = ant;
  }
  for (const atual of caminho.reverse()) {
    const ant = mesAnterior(atual);
    saldo = Math.round((saldo + entradasDoMes(ant) - despesaDoMes(ant)) * 100) / 100;
  }
  return saldo;
}
