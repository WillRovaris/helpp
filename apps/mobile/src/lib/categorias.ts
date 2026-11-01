// Categorias principais com subcategorias (pedido do dono): a despesa guarda a categoria mais detalhada
// e os relatórios somam tudo na principal. Só um nível: subcategoria não tem subcategoria.

type ComPai = { id: string; pai_id?: string | null };

/** Categorias sem principal. Subcategoria cuja principal foi excluída volta a contar como principal. */
export function principaisDe<T extends ComPai>(categorias: T[]): T[] {
  const ids = new Set(categorias.map((c) => c.id));
  return categorias.filter((c) => !c.pai_id || !ids.has(c.pai_id));
}

export function subcategoriasDe<T extends ComPai>(categorias: T[], paiId: string): T[] {
  return categorias.filter((c) => c.pai_id === paiId);
}

/** Principal de uma categoria (ela mesma, se já for principal ou se a categoria não existir mais). */
export function idPrincipal(id: string, categorias: ComPai[]): string {
  const pai = categorias.find((c) => c.id === id)?.pai_id;
  return pai && categorias.some((c) => c.id === pai) ? pai : id;
}

/** A categoria + as subcategorias dela. */
export function idsDaFamilia(categoriaId: string, categorias: ComPai[]): Set<string> {
  return new Set([categoriaId, ...subcategoriasDe(categorias, categoriaId).map((c) => c.id)]);
}

/** Soma por categoria principal; despesa sem categoria fica em null. */
export function somarPorPrincipal(gastos: { categoria_id: string | null; valor: number }[], categorias: ComPai[]): Map<string | null, number> {
  const pais = new Map(categorias.map((c) => [c.id, idPrincipal(c.id, categorias)]));
  const somas = new Map<string | null, number>();
  for (const g of gastos) {
    const id = g.categoria_id ? (pais.get(g.categoria_id) ?? g.categoria_id) : null;
    somas.set(id, (somas.get(id) ?? 0) + g.valor);
  }
  return somas;
}

export interface LinhaSubcategoria {
  /** null = despesas lançadas direto na principal. */
  id: string | null;
  nome: string;
  total: number;
}

/**
 * Quanto foi em cada subcategoria de uma principal, maiores primeiro.
 * Vazio quando nenhuma despesa usa subcategoria (não há o que detalhar).
 */
export function somarSubcategorias(gastos: { categoria_id: string | null; valor: number }[], categorias: (ComPai & { nome: string })[], paiId: string): LinhaSubcategoria[] {
  const linhas = subcategoriasDe(categorias, paiId)
    .map((c) => ({ id: c.id as string | null, nome: c.nome, total: gastos.filter((g) => g.categoria_id === c.id).reduce((s, g) => s + g.valor, 0) }))
    .filter((l) => l.total > 0);
  if (!linhas.length) return [];
  const naPrincipal = gastos.filter((g) => g.categoria_id === paiId).reduce((s, g) => s + g.valor, 0);
  if (naPrincipal > 0) linhas.push({ id: null, nome: "Sem subcategoria", total: naPrincipal });
  return linhas.sort((a, b) => b.total - a.total);
}
