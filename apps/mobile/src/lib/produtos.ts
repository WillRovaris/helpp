// Preço dos produtos a partir dos itens das notas fiscais lidas (pedido do dono:
// usar o que foi comprado para comparar preços entre mercados e ver se está subindo).

export interface ItemNota {
  nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  nota_id: string;
}

export interface NotaResumo {
  id: string;
  estabelecimento: string | null;
  data_compra: string | null;
}

export interface Compra {
  data: string; // YYYY-MM-DD
  mercado: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
}

export interface Produto {
  chave: string;
  nome: string;
  compras: Compra[]; // mais recentes primeiro
  totalGasto: number;
  vezes: number;
  ultimoPreco: number;
  menorPreco: number;
  maiorPreco: number;
  precoMedio: number;
  /** Mercado onde o preço médio foi menor (só quando comprou em mais de um). */
  maisBarato: { mercado: string; precoMedio: number } | null;
  /** Variação do primeiro para o último preço (0.12 = +12%). null com uma compra só. */
  variacao: number | null;
}

// Acentos separados da letra pelo normalize("NFD") (faixa U+0300 a U+036F), montada por código
// para não depender de caracteres invisíveis no arquivo.
const ACENTOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** Tira acento, deixa minúsculo e junta espaços: "LEITE  Integral" → "leite integral". */
export function semAcento(t: string): string {
  return t.normalize("NFD").replace(ACENTOS, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Nome do mercado mais curto e legível ("SUPERMERCADOS KOCH LTDA" → "Supermercados Koch"). */
export function nomeMercado(t: string | null): string {
  if (!t) return "Mercado";
  const limpo = t.replace(/\b(ltda|eireli|me|epp|s\/?a|s\.a\.)\b\.?/gi, "").replace(/\s+/g, " ").trim();
  return limpo
    .toLowerCase()
    .split(" ")
    .map((p) => (p.length > 2 ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Agrupa os itens de todas as notas por produto (mesmo nome = mesmo produto). */
export function agruparProdutos(itens: ItemNota[], notas: NotaResumo[]): Produto[] {
  const notaPorId = new Map(notas.map((n) => [n.id, n]));
  const grupos = new Map<string, { nome: string; compras: Compra[] }>();
  for (const i of itens) {
    const nota = notaPorId.get(i.nota_id);
    if (!nota || !i.nome) continue;
    const chave = semAcento(i.nome);
    const qtd = Number(i.quantidade) || 1;
    const unit = Number(i.valor_unitario) || (Number(i.valor_total) || 0) / qtd;
    const compra: Compra = {
      data: (nota.data_compra ?? "").slice(0, 10),
      mercado: nomeMercado(nota.estabelecimento),
      quantidade: qtd,
      precoUnitario: arred(unit),
      total: arred(Number(i.valor_total) || unit * qtd),
    };
    const g = grupos.get(chave) ?? { nome: i.nome.replace(/\s+/g, " ").trim(), compras: [] };
    g.compras.push(compra);
    grupos.set(chave, g);
  }

  return [...grupos.entries()].map(([chave, g]) => {
    const compras = g.compras.sort((a, b) => (a.data < b.data ? 1 : -1));
    const precos = compras.map((c) => c.precoUnitario);
    const porMercado = new Map<string, number[]>();
    for (const c of compras) porMercado.set(c.mercado, [...(porMercado.get(c.mercado) ?? []), c.precoUnitario]);
    const medias = [...porMercado.entries()].map(([mercado, ps]) => ({ mercado, precoMedio: arred(ps.reduce((s, p) => s + p, 0) / ps.length) }));
    medias.sort((a, b) => a.precoMedio - b.precoMedio);
    const primeiro = compras[compras.length - 1].precoUnitario;
    const ultimo = compras[0].precoUnitario;
    return {
      chave,
      nome: g.nome,
      compras,
      totalGasto: arred(compras.reduce((s, c) => s + c.total, 0)),
      vezes: compras.length,
      ultimoPreco: ultimo,
      menorPreco: Math.min(...precos),
      maiorPreco: Math.max(...precos),
      precoMedio: arred(precos.reduce((s, p) => s + p, 0) / precos.length),
      maisBarato: medias.length > 1 ? medias[0] : null,
      variacao: compras.length > 1 && primeiro > 0 ? (ultimo - primeiro) / primeiro : null,
    };
  });
}

/** Busca por palavras (todas precisam aparecer, sem acento): "leite int" acha "LEITE INTEGRAL". */
export function buscarProdutos(produtos: Produto[], texto: string): Produto[] {
  const palavras = semAcento(texto).split(" ").filter(Boolean);
  if (!palavras.length) return produtos;
  return produtos.filter((p) => palavras.every((w) => p.chave.includes(w)));
}

/** Produtos em que mais gastou desde a data (YYYY-MM-DD). */
export function maisGastos(produtos: Produto[], desde: string, qtd = 20): { produto: Produto; gasto: number }[] {
  return produtos
    .map((p) => ({ produto: p, gasto: arred(p.compras.filter((c) => c.data >= desde).reduce((s, c) => s + c.total, 0)) }))
    .filter((x) => x.gasto > 0)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, qtd);
}
