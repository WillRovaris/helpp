// Caixinhas: quanto falta para a meta e quanto guardar por mês até a data escolhida.

export interface PlanoCaixinha {
  /** 0–1: quanto da meta já foi guardado. */
  progresso: number | null;
  falta: number | null;
  /** Meses até a data alvo (contando o mês atual), quando houver data. */
  meses: number | null;
  /** Quanto guardar por mês para chegar na meta até a data. */
  porMes: number | null;
}

export function planoCaixinha(saldo: number, meta: number | null, dataAlvo: string | null, hoje: string): PlanoCaixinha {
  if (!meta || meta <= 0) return { progresso: null, falta: null, meses: null, porMes: null };
  const falta = Math.max(0, Math.round((meta - saldo) * 100) / 100);
  const progresso = Math.min(1, Math.max(0, saldo / meta));
  if (!dataAlvo) return { progresso, falta, meses: null, porMes: null };
  const meses = Math.max(
    1,
    (Number(dataAlvo.slice(0, 4)) - Number(hoje.slice(0, 4))) * 12 + (Number(dataAlvo.slice(5, 7)) - Number(hoje.slice(5, 7))) + 1,
  );
  return { progresso, falta, meses, porMes: falta > 0 ? Math.ceil((falta / meses) * 100) / 100 : 0 };
}
