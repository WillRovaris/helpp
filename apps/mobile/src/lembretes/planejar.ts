// Quais lembretes agendar (sem dependências de React Native, para testar no computador).
import { periodoNoMes, vencimentoNoMes } from "../lib/contas";
import { faturaDaCompra, faturaVizinha } from "../lib/fatura";
import { dataDeISO, formatarReais } from "../lib/format";

export interface Lembrete {
  quando: Date;
  titulo: string;
  corpo: string;
  tela: "Contas" | "Cartoes" | "Fechamento" | "Lancar";
}

/**
 * Lembrete à noite para lançar as despesas do dia (próximos 7 dias, no horário escolhido).
 * Hoje fica de fora se já lançaram alguma despesa hoje.
 */
export function lembretesNoturnos(agora: Date, hora: number, lancouHoje: boolean): Lembrete[] {
  const lista: Lembrete[] = [];
  for (let d = 0; d < 7; d++) {
    if (d === 0 && lancouHoje) continue;
    const quando = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d, hora, 0, 0, 0);
    if (quando <= agora) continue;
    lista.push({ quando, titulo: "📝 Lançou as despesas de hoje?", corpo: "Leva um minuto e o mês fica certinho. Toque para lançar.", tela: "Lancar" });
  }
  return lista;
}

const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Dia 1 do mês seguinte, no horário escolhido: "📅 Outubro fechou!" (abre o fechamento do mês). */
export function lembreteFechamento(agora: Date, hora: number): Lembrete {
  const quando = new Date(agora.getFullYear(), agora.getMonth() + 1, 1, hora, 0, 0, 0);
  const nome = MESES_NOME[agora.getMonth()];
  return {
    quando,
    titulo: `📅 ${nome[0].toUpperCase()}${nome.slice(1)} fechou!`,
    corpo: `Veja o balanço: quanto entrou, quanto saiu e quanto sobrou em ${nome}.`,
    tela: "Fechamento",
  };
}

/**
 * Lembretes no dia anterior e no dia do vencimento, no horário escolhido:
 * contas fixas ainda não pagas (mês atual e seguinte) e faturas dos cartões.
 */
export function planejarLembretes(opts: {
  agora: Date;
  hora: number;
  competencias: string[]; // YYYY-MM-01 (mês atual e seguinte)
  contas: { id: string; nome: string; valor: number | null; dia_vencimento: number; inicio?: string | null; meses?: number | null }[];
  pagas: Set<string>; // `${contaId}|${competencia}`
  cartoes: { id: string; nome: string; dia_fechamento: number; dia_vencimento: number }[];
  /** Faturas já marcadas como pagas: `${cartaoId}|${vencimento}`. */
  faturasPagas?: Set<string>;
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
      if (!periodoNoMes(c, comp)) continue; // fora do período da conta (ex.: plano de 12 meses)
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
      if (opts.faturasPagas?.has(`${c.id}|${f.vencimento}`)) continue;
      adicionar(f.vencimento, (q) => `💳 Fatura ${c.nome} vence ${q}`, "Toque para ver o valor da fatura.", "Cartoes");
    }
  }

  return lista.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}
