export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito";

export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "debito", rotulo: "Débito" },
  { valor: "credito", rotulo: "Crédito" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
];

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  ordem: number;
  /** Limite de gasto por mês (vazio = sem limite). */
  limite?: number | null;
}

export interface Cartao {
  id: string;
  nome: string;
  limite: number;
  dia_fechamento: number;
  dia_vencimento: number;
}

export interface Gasto {
  id: string;
  valor: number;
  data: string;
  descricao: string | null;
  categoria_id: string | null;
  forma_pagamento: FormaPagamento;
  cartao_id: string | null;
  pago_por: string | null;
  nota_id: string | null;
  /** Dia em que o dinheiro sai (define o mês). Vazio = calculado (cartão: vencimento da fatura). */
  data_pagamento?: string | null;
  parcelamento_id?: string | null;
  parcela?: number | null;
  parcelas?: number | null;
  /** Conta fixa do mês ainda não paga, mostrada como despesa (não existe na tabela gastos). */
  contaFixa?: { contaId: string; competencia: string; valorVaria: boolean };
}

// O banco guarda o nome do ícone; sem pacote de ícones por enquanto, cada um vira um emoji.
const EMOJI: Record<string, string> = {
  cart: "🛒",
  home: "🏠",
  receipt: "🧾",
  car: "🚗",
  medkit: "💊",
  "game-controller": "🎮",
  restaurant: "🍽️",
  paw: "🐾",
  "ellipsis-horizontal": "📦",
  pricetag: "🏷️",
  school: "🎓",
  shirt: "👕",
  gift: "🎁",
  airplane: "✈️",
  cash: "💸",
  church: "⛪",
};

/** Texto do gasto nas listas: descrição (ou categoria) + "(2/10)" se for parcela. */
export function tituloGasto(g: Gasto, nomeCategoria: string | undefined): string {
  const base = g.descricao || nomeCategoria || "Sem categoria";
  return g.parcelas && g.parcelas > 1 ? `${base} (${g.parcela}/${g.parcelas})` : base;
}

export function emojiCategoria(icone: string | undefined): string {
  return (icone && EMOJI[icone]) ?? "🏷️";
}

export interface ContaFixa {
  id: string;
  nome: string;
  /** null = valor muda todo mês (luz, água). */
  valor: number | null;
  dia_vencimento: number;
  categoria_id: string | null;
  /** Primeiro mês em que vale (YYYY-MM-01). Vazio = desde sempre. */
  inicio?: string | null;
  /** Por quantos meses. Vazio = sem prazo. */
  meses?: number | null;
  created_at?: string | null;
  /** Quem da casa paga esta conta (user_id). */
  pago_por?: string | null;
}

export interface PagamentoConta {
  id: string;
  conta_id: string;
  competencia: string;
  valor: number;
  pago_em: string;
  gasto_id: string | null;
}

export interface FaturaPaga {
  id: string;
  cartao_id: string;
  vencimento: string;
  valor: number | null;
  pago_em: string;
}

export interface Sugestao {
  id: string;
  texto: string;
  feita: boolean;
  feita_em: string | null;
  created_by: string | null;
  created_at: string;
}

/** Entrada de dinheiro (salário, extra...). Recorrente = repete todo mês desde o mês da data até `ate` (YYYY-MM). */
export interface Receita {
  id: string;
  valor: number;
  tipo: string;
  descricao: string | null;
  data: string;
  recebido_por: string | null;
  recorrente: boolean;
  ate: string | null;
  created_at: string;
}

/** Tipos de entrada (ícone escolhido na hora de lançar). */
export const TIPOS_RECEITA: { valor: string; emoji: string; nome: string }[] = [
  { valor: "salario", emoji: "💼", nome: "Salário" },
  { valor: "extra", emoji: "🛠️", nome: "Atividade extra" },
  { valor: "comissao", emoji: "🤝", nome: "Comissão" },
  { valor: "bonus", emoji: "🎁", nome: "Bônus" },
  { valor: "aposta", emoji: "🎲", nome: "Aposta" },
  { valor: "venda", emoji: "🏷️", nome: "Venda" },
  { valor: "rendimento", emoji: "📈", nome: "Rendimentos" },
  { valor: "reembolso", emoji: "↩️", nome: "Reembolso" },
  { valor: "presente", emoji: "💝", nome: "Presente / ajuda" },
  { valor: "outro", emoji: "💰", nome: "Outra entrada" },
];

export function tipoReceita(valor: string | null | undefined) {
  return TIPOS_RECEITA.find((t) => t.valor === valor) ?? TIPOS_RECEITA[TIPOS_RECEITA.length - 1];
}

/** Arquivo de extrato/fatura que foi importado (histórico na tela de importar). */
export interface Importacao {
  id: string;
  arquivo: string | null;
  formato: string | null;
  banco: string | null;
  tipo: string | null;
  cartao_id: string | null;
  lancamentos: number;
  total: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  created_by: string | null;
  created_at: string;
  /** Nome dado pela pessoa (ex.: "Extrato Bradesco conta salário"); vazio = automático. */
  nome?: string | null;
}
