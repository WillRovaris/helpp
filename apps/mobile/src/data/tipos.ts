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
  parcelamento_id?: string | null;
  parcela?: number | null;
  parcelas?: number | null;
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
