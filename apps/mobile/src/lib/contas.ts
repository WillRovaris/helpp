import type { ContaFixa, PagamentoConta } from "../data/tipos";
import { dataDeISO, dataISO } from "./format";

/** Competência (YYYY-MM-01) de um mês; `mes` é 0–11. */
export function competencia(ano: number, mes: number): string {
  return dataISO(new Date(ano, mes, 1));
}

/** Data de vencimento da conta no mês da competência (dia 31 em fevereiro vira 28/29). */
export function vencimentoNoMes(comp: string, dia: number): string {
  const d = dataDeISO(comp);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return dataISO(new Date(d.getFullYear(), d.getMonth(), Math.min(dia, ultimo)));
}

export type SituacaoConta = "paga" | "atrasada" | "vence-logo" | "a-vencer";

export interface ContaDoMes {
  conta: ContaFixa;
  vencimento: string;
  pagamento: PagamentoConta | null;
  situacao: SituacaoConta;
  /** Dias até o vencimento (negativo = atrasada). */
  dias: number;
}

/** Junta contas e pagamentos de um mês, ordenando: atrasadas, vencendo, a vencer, pagas. */
export function contasDoMes(contas: ContaFixa[], pagamentos: PagamentoConta[], comp: string, hoje: string): ContaDoMes[] {
  const porConta = new Map(pagamentos.map((p) => [p.conta_id, p]));
  const msDia = 86400000;
  const lista = contas.map((conta) => {
    const vencimento = vencimentoNoMes(comp, conta.dia_vencimento);
    const pagamento = porConta.get(conta.id) ?? null;
    const dias = Math.round((dataDeISO(vencimento).getTime() - dataDeISO(hoje).getTime()) / msDia);
    const situacao: SituacaoConta = pagamento ? "paga" : dias < 0 ? "atrasada" : dias <= 3 ? "vence-logo" : "a-vencer";
    return { conta, vencimento, pagamento, situacao, dias };
  });
  const ordem: Record<SituacaoConta, number> = { atrasada: 0, "vence-logo": 1, "a-vencer": 2, paga: 3 };
  return lista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.vencimento.localeCompare(b.vencimento));
}

export function textoSituacao(c: ContaDoMes): string {
  if (c.situacao === "paga") return "Paga";
  if (c.dias < 0) return c.dias === -1 ? "Venceu ontem" : `Atrasada há ${-c.dias} dias`;
  if (c.dias === 0) return "Vence hoje";
  if (c.dias === 1) return "Vence amanhã";
  return `Vence em ${c.dias} dias`;
}
