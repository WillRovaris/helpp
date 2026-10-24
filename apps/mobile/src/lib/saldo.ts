// Saldo que passa de um mês para o outro (pedido do dono):
// o que sobrou no mês anterior entra automaticamente no mês seguinte.
//   saldo inicial do mês = renda + saldo inicial do mês anterior − despesas do mês anterior
// A pessoa pode corrigir o saldo inicial de um mês (ajuste); a conta continua dali em diante.

/** "2026-10" → "2026-09". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Saldo que vem do mês anterior para `mes` (YYYY-MM).
 * @param renda renda mensal da casa (a mesma para todos os meses)
 * @param despesaDoMes total de despesas de um mês (YYYY-MM)
 * @param ajustes saldos iniciais corrigidos à mão (YYYY-MM → valor)
 * @param primeiroMes mês em que a casa começou a lançar: começa com saldo zero
 */
export function saldoAnterior(
  mes: string,
  renda: number,
  despesaDoMes: (mes: string) => number,
  ajustes: Record<string, number>,
  primeiroMes: string | null,
): number {
  // Volta mês a mês até achar um ajuste ou o começo; depois soma para frente.
  const caminho: string[] = [];
  let m = mes;
  let saldo = 0;
  for (let i = 0; i < 120; i++) {
    if (ajustes[m] != null) {
      saldo = ajustes[m];
      break;
    }
    if (!primeiroMes || m <= primeiroMes) break;
    caminho.push(m);
    m = mesAnterior(m);
  }
  // `m` é o mês de partida (saldo conhecido); cada mês do caminho recebe a sobra do anterior.
  for (const atual of caminho.reverse()) {
    const ant = mesAnterior(atual);
    saldo = Math.round((saldo + renda - despesaDoMes(ant)) * 100) / 100;
  }
  return saldo;
}
