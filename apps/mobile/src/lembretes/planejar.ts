// Quais lembretes agendar (sem dependências de React Native, para testar no computador).
import { vencimentoNoMes } from "../lib/contas";
import { faturaDaCompra, faturaVizinha } from "../lib/fatura";
import { dataDeISO, formatarReais } from "../lib/format";

export interface Lembrete {
  quando: Date;
  titulo: string;
  corpo: string;
  tela: "Contas" | "Cartoes";
}

/**
 * Lembretes no dia anterior e no dia do vencimento, no horário escolhido:
 * contas fixas ainda não pagas (mês atual e seguinte) e faturas dos cartões.
 */
export function planejarLembretes(opts: {
  agora: Date;
  hora: number;
  competencias: string[]; // YYYY-MM-01 (mês atual e seguinte)
  contas: { id: string; nome: string; valor: number | null; dia_vencimento: number }[];
  pagas: Set<string>; // `${contaId}|${competencia}`
  cartoes: { nome: string; dia_fechamento: number; dia_vencimento: number }[];
}): Lembrete[] {
  const lista: Lembrete[] = [];
  const noHorario = (iso: string, diasAntes: number) => {
    const d = dataDeISO(iso);
    d.setDate(d.getDate() - diasAntes);
    d.setHours(opts.hora, 0, 0, 0);
    return d;
  };
  const adicionar = (venc: string, titulo: (quando: string) => string, corpo: string, tela: Lembrete["tela"]) => {
    for (const [dias, quando] of [[1, "amanhã"], [0, "hoje"]] as const) {
      const d = noHorario(venc, dias);
      if (d > opts.agora) lista.push({ quando: d, titulo: titulo(quando), corpo, tela });
    }
  };

  for (const comp of opts.competencias) {
    for (const c of opts.contas) {
      if (opts.pagas.has(`${c.id}|${comp}`)) continue;
      const venc = vencimentoNoMes(comp, c.dia_vencimento);
      adicionar(
        venc,
        (q) => `🧾 ${c.nome} vence ${q}`,
        `${c.valor != null ? formatarReais(c.valor) + " · " : ""}Toque para marcar como paga.`,
        "Contas",
      );
    }
  }

  const hojeISO = `${opts.agora.getFullYear()}-${String(opts.agora.getMonth() + 1).padStart(2, "0")}-${String(opts.agora.getDate()).padStart(2, "0")}`;
  for (const c of opts.cartoes) {
    const aberta = faturaDaCompra(hojeISO, c.dia_fechamento, c.dia_vencimento);
    const anterior = faturaVizinha(aberta.fechamento, -1, c.dia_fechamento, c.dia_vencimento);
    for (const f of [anterior, aberta]) {
      adicionar(f.vencimento, (q) => `💳 Fatura ${c.nome} vence ${q}`, "Toque para ver o valor da fatura.", "Cartoes");
    }
  }

  return lista.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}
