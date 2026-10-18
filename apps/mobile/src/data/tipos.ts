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
};

export function emojiCategoria(icone: string | undefined): string {
  return (icone && EMOJI[icone]) ?? "🏷️";
}
