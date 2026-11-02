// Lista de compras × notas fiscais (pedido do dono): a nota do mercado marca sozinha o que estava
// na lista, e "Compras do mês" junta tudo o que foi comprado para virar histórico.
import { nomeMercado, semAcento } from "./produtos";

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "com"]);

export function palavras(nome: string): string[] {
  return semAcento(nome)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p));
}

export const semPlural = (p: string) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p);

/** Palavra da lista × palavra da nota. Aceita plural e abreviação ("refrigerante" × "REFRIG"), nunca pedaço curto ("sal" × "SALGADINHO"). */
function mesmaPalavra(lista: string, nota: string): boolean {
  const a = semPlural(lista);
  const b = semPlural(nota);
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

/** Todas as palavras do item da lista precisam aparecer no nome do item da nota. */
export function itemCombina(nomeLista: string, nomeNota: string): boolean {
  const lista = palavras(nomeLista);
  const nota = palavras(nomeNota);
  return lista.length > 0 && lista.every((p) => nota.some((n) => mesmaPalavra(p, n)));
}

/**
 * Qual item da nota corresponde a cada item pendente da lista. Cada item da nota vale uma vez e os
 * nomes mais completos escolhem primeiro ("leite condensado" antes de "leite").
 */
export function casarListaComNota<L extends { id: string; nome: string }, N extends { id: string; nome: string }>(pendentes: L[], itensNota: N[]): { lista: L; nota: N }[] {
  const usados = new Set<string>();
  const pares: { lista: L; nota: N }[] = [];
  for (const lista of [...pendentes].sort((a, b) => palavras(b.nome).length - palavras(a.nome).length)) {
    const candidatos = itensNota.filter((n) => !usados.has(n.id) && itemCombina(lista.nome, n.nome));
    // Prefere o item cujo nome começa pelo que foi escrito na lista ("LEITE UHT" antes de "DOCE DE LEITE").
    const nota = candidatos.find((n) => mesmaPalavra(palavras(lista.nome)[0], palavras(n.nome)[0])) ?? candidatos[0];
    if (!nota) continue;
    usados.add(nota.id);
    pares.push({ lista, nota });
  }
  return pares;
}

export interface ItemComprado {
  id: string;
  nome: string;
  quantidade: number;
  valor: number;
  /** Item da lista ligado a este (permite voltar para a lista). */
  listaId: string | null;
}

export interface CompraDoMes {
  notaId: string;
  data: string; // YYYY-MM-DD
  mercado: string;
  total: number;
  itens: ItemComprado[];
}

export interface MarcadoAMao {
  id: string;
  nome: string;
  quantidade: number;
  data: string; // YYYY-MM-DD
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Dia em que o item foi comprado (itens antigos, sem a data gravada, usam a última alteração). */
export function diaDaCompra(i: { comprado_em?: string | null; updated_at?: string | null; created_at?: string | null }): string {
  return (i.comprado_em ?? i.updated_at ?? i.created_at ?? "").slice(0, 10);
}

/**
 * Tudo o que foi comprado no mês (YYYY-MM): notas de supermercado com seus itens + itens marcados à mão.
 * Nota ligada a despesa de outra categoria (ex.: farmácia) fica de fora; `mercados` são as categorias de mercado.
 */
export function montarComprasDoMes(mes: string, dados: DadosCompras) {
  return montarCompras(`${mes}-01`, `${mes}-31`, dados);
}

type DadosCompras = {
    notas: { id: string; estabelecimento: string | null; data_compra: string | null }[];
    itensNota: { id: string; nota_id: string; nome: string; quantidade: number; valor_unitario?: number | null; valor_total: number }[];
    gastos: { nota_id?: string | null; data: string; categoria_id: string | null }[];
    lista: { id: string; nome: string; quantidade: number; comprado: boolean; comprado_em?: string | null; nota_item_id?: string | null; updated_at?: string | null; created_at?: string | null }[];
    mercados: Set<string>;
};

/** O mesmo, para qualquer período: de e ate são datas YYYY-MM-DD (incluídas). */
export function montarCompras(de: string, ate: string, dados: DadosCompras) {
  const noPeriodo = (data: string) => data >= de && data <= ate;
  const despesaDaNota = new Map(dados.gastos.filter((g) => g.nota_id).map((g) => [g.nota_id!, g]));
  const compras = new Map<string, CompraDoMes>();
  for (const n of dados.notas) {
    const despesa = despesaDaNota.get(n.id);
    if (despesa?.categoria_id && !dados.mercados.has(despesa.categoria_id)) continue;
    // A data da despesa é a da nota no horário do Brasil; data_compra pode vir da nuvem em UTC.
    const data = despesa?.data ?? (n.data_compra ?? "").slice(0, 10);
    if (noPeriodo(data)) compras.set(n.id, { notaId: n.id, data, mercado: nomeMercado(n.estabelecimento), total: 0, itens: [] });
  }

  const listaPorItemNota = new Map(dados.lista.filter((i) => i.comprado && i.nota_item_id).map((i) => [i.nota_item_id!, i.id]));
  const ligados = new Set<string>();
  for (const i of dados.itensNota) {
    const listaId = listaPorItemNota.get(i.id);
    if (listaId) ligados.add(listaId);
    const compra = compras.get(i.nota_id);
    if (!compra) continue;
    const quantidade = Number(i.quantidade) || 1;
    const valor = Number(i.valor_total) || (Number(i.valor_unitario) || 0) * quantidade;
    compra.itens.push({ id: i.id, nome: i.nome, quantidade, valor: arred(valor), listaId: listaId ?? null });
    compra.total = arred(compra.total + valor);
  }

  const lista = [...compras.values()].filter((c) => c.itens.length).sort((a, b) => (a.data < b.data ? 1 : -1));
  // Item ligado a nota que foi excluída volta a contar como marcado à mão (não some do histórico).
  const marcados: MarcadoAMao[] = dados.lista
    .filter((i) => i.comprado && !ligados.has(i.id) && noPeriodo(diaDaCompra(i)))
    .map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, data: diaDaCompra(i) }))
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  return {
    compras: lista,
    marcados,
    total: arred(lista.reduce((s, c) => s + c.total, 0)),
    qtdItens: lista.reduce((s, c) => s + c.itens.length, 0) + marcados.length,
  };
}
