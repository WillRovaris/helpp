// "Essa despesa já foi lançada?" — compara uma despesa nova com as que já
// existem (de qualquer pessoa da casa). Sem React Native, para testar no computador.

export interface DespesaComparavel {
  valor: number;
  data: string; // YYYY-MM-DD
  descricao: string | null;
  categoria_id: string | null;
}

function semAcento(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diasEntre(a: string, b: string): number {
  const [a1, a2, a3] = a.split("-").map(Number);
  const [b1, b2, b3] = b.split("-").map(Number);
  return Math.abs(Date.UTC(a1, a2 - 1, a3) - Date.UTC(b1, b2 - 1, b3)) / 86400000;
}

/** Descrições "parecidas": uma contém a outra, ou têm uma palavra relevante (4+ letras) em comum. */
function descricoesParecidas(a: string | null, b: string | null): boolean {
  const x = semAcento(a ?? "");
  const y = semAcento(b ?? "");
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const palavras = new Set(x.split(" ").filter((p) => p.length >= 4));
  return y.split(" ").some((p) => p.length >= 4 && palavras.has(p));
}

/**
 * Mesma despesa = mesmo valor, data com até 1 dia de diferença e
 * (mesma categoria OU descrição parecida OU as duas sem descrição).
 */
export function pareceMesmaDespesa(nova: DespesaComparavel, existente: DespesaComparavel): boolean {
  if (Math.abs(nova.valor - existente.valor) >= 0.005) return false;
  if (diasEntre(nova.data, existente.data) > 1) return false;
  const mesmaCategoria = !!nova.categoria_id && nova.categoria_id === existente.categoria_id;
  const semDescricao = !nova.descricao?.trim() && !existente.descricao?.trim();
  return mesmaCategoria || descricoesParecidas(nova.descricao, existente.descricao) || semDescricao;
}
