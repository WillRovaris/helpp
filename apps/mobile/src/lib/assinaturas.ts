// Assinaturas detectadas: cobranças com a mesma descrição e valor parecido em vários meses
// (Netflix, Spotify, academia...) que ainda não estão cadastradas como conta fixa.

export interface GastoParaAssinatura {
  id: string;
  valor: number;
  data: string;
  descricao: string | null;
  cartao_id: string | null;
  categoria_id?: string | null;
  parcelamento_id?: string | null;
}

export interface Assinatura {
  chave: string;
  nome: string;
  valor: number;
  /** Dia do mês em que costuma cobrar. */
  dia: number;
  meses: number;
  ultima: string;
  cartaoId: string | null;
  categoriaId: string | null;
}

/** "NETFLIX.COM 12/10" → "netflix com" (sem números, datas e pontuação). */
export function chaveDescricao(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function detectarAssinaturas(gastos: GastoParaAssinatura[], nomesContasFixas: string[], hoje: string): Assinatura[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const mesesAtras = (iso: string) => (ano - Number(iso.slice(0, 4))) * 12 + (mes - Number(iso.slice(5, 7)));
  const contas = nomesContasFixas.map(chaveDescricao).filter((c) => c.length >= 3);

  const grupos = new Map<string, GastoParaAssinatura[]>();
  for (const g of gastos) {
    if (!g.descricao || g.parcelamento_id || g.valor < 3) continue;
    const m = mesesAtras(g.data);
    if (m < 0 || m > 6) continue;
    const chave = chaveDescricao(g.descricao);
    if (chave.length < 3) continue;
    const k = `${chave}|${g.cartao_id ?? ""}`;
    grupos.set(k, [...(grupos.get(k) ?? []), g]);
  }

  const lista: Assinatura[] = [];
  for (const [k, gs] of grupos) {
    const chave = k.split("|")[0];
    // um por mês (o mais recente de cada mês)
    const porMes = new Map<string, GastoParaAssinatura>();
    for (const g of gs) {
      const m = g.data.slice(0, 7);
      const atual = porMes.get(m);
      if (!atual || g.data > atual.data) porMes.set(m, g);
    }
    const lancamentos = [...porMes.values()];
    if (lancamentos.length < 3) continue;
    const ultima = lancamentos.map((g) => g.data).sort().reverse()[0];
    if (mesesAtras(ultima) > 1) continue; // parou de cobrar
    const valor = mediana(lancamentos.map((g) => g.valor));
    if (lancamentos.some((g) => Math.abs(g.valor - valor) > valor * 0.15)) continue; // valor muda demais
    if (contas.some((c) => chave.includes(c) || c.includes(chave))) continue; // já é conta fixa
    const dias = lancamentos.map((g) => Number(g.data.slice(8, 10)));
    const ref = gs.find((g) => g.data === ultima)!;
    lista.push({
      chave,
      // sem datas do tipo "12/10" que alguns bancos colocam na descrição
      nome: ref.descricao!.replace(/\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, " ").replace(/\s+/g, " ").trim(),
      valor,
      dia: mediana(dias),
      meses: lancamentos.length,
      ultima,
      cartaoId: ref.cartao_id,
      categoriaId: ref.categoria_id ?? null,
    });
  }
  return lista.sort((a, b) => b.valor - a.valor);
}
