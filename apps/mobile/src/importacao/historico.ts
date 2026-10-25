// Histórico de arquivos importados: de onde veio ("Extrato Bradesco Will"), quando subiu
// e a última atualização de cada origem — para saber quando refazer a importação.

export const BANCOS = ["Nubank", "Bradesco", "Banco do Brasil", "Caixa", "C6", "Digio", "Itaú", "Santander", "Inter", "Outro"];

/** Tenta descobrir o banco pelo que o leitor achou no arquivo ou pelo nome do arquivo. */
export function bancoProvavel(nomeArquivo: string, doLeitor: string | null): string | null {
  const t = `${doLeitor ?? ""} ${nomeArquivo}`.toLowerCase();
  if (/nubank|nu pagamentos|nu_|^nu[ -]/.test(t)) return "Nubank";
  if (/bradesco/.test(t)) return "Bradesco";
  if (/banco do brasil|bancodobrasil|\bbb\b|ourocard/.test(t)) return "Banco do Brasil";
  if (/caixa|cef/.test(t)) return "Caixa";
  if (/\bc6\b|c6bank|c6 bank/.test(t)) return "C6";
  if (/digio/.test(t)) return "Digio";
  if (/ita[uú]/.test(t)) return "Itaú";
  if (/santander/.test(t)) return "Santander";
  if (/\binter\b|bancointer/.test(t)) return "Inter";
  return null;
}

export interface ImportacaoHistorico {
  id: string;
  tipo: string | null;
  banco: string | null;
  cartao_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** "Extrato Bradesco Will" / "Fatura Nubank Thamara". */
export function rotuloImportacao(imp: ImportacaoHistorico, nomeCartao: string | undefined, pessoa: string | undefined): string {
  const origem = imp.tipo === "fatura" ? `Fatura ${nomeCartao ?? imp.banco ?? "do cartão"}` : `Extrato ${imp.banco ?? "(banco não informado)"}`;
  return pessoa ? `${origem} ${pessoa}` : origem;
}

/** Mais recente de cada origem (tipo + banco/cartão + pessoa), mais recentes primeiro. */
export function ultimaDeCadaOrigem<T extends ImportacaoHistorico>(lista: T[]): T[] {
  const porOrigem = new Map<string, T>();
  for (const imp of lista) {
    const chave = `${imp.tipo}|${imp.tipo === "fatura" ? imp.cartao_id : imp.banco}|${imp.created_by}`;
    const atual = porOrigem.get(chave);
    if (!atual || imp.created_at > atual.created_at) porOrigem.set(chave, imp);
  }
  return [...porOrigem.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** "hoje", "ontem", "há 5 dias", "há 2 meses". */
export function haQuanto(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const inicioDia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicioDia(agora) - inicioDia(d)) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 45) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/** Id fixo a partir de um texto (mesmo texto → mesmo id), no formato de uuid. */
export function idDeTexto(texto: string): string {
  const partes: string[] = [];
  for (let semente = 0; semente < 4; semente++) {
    let h = (0x811c9dc5 ^ (semente * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0;
    partes.push(h.toString(16).padStart(8, "0"));
  }
  const hex = partes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

interface GastoImportado {
  importacao_id?: string | null;
  cartao_id: string | null;
  created_by?: string | null;
  pago_por?: string | null;
  created_at?: string | null;
  data: string;
  valor: number;
}

/**
 * Importações feitas antes de existir o histórico: reconstrói pelos lançamentos importados
 * (mesma pessoa, mesmo cartão/extrato e mesmo minuto de gravação = um arquivo).
 */
export function reconstruirHistorico(gastos: GastoImportado[], casaId: string) {
  const grupos = new Map<string, GastoImportado[]>();
  for (const g of gastos) {
    if (!g.importacao_id || !g.created_at) continue;
    const quem = g.created_by ?? g.pago_por ?? "";
    const chave = `${quem}|${g.cartao_id ?? "extrato"}|${g.created_at.slice(0, 16)}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(g);
    grupos.set(chave, lista);
  }
  return [...grupos.entries()].map(([chave, lista]) => {
    const datas = lista.map((g) => g.data).sort();
    const primeiro = lista[0];
    return {
      id: idDeTexto(`${casaId}|${chave}`),
      casa_id: casaId,
      arquivo: null,
      formato: null,
      banco: null,
      tipo: primeiro.cartao_id ? "fatura" : "extrato",
      cartao_id: primeiro.cartao_id,
      lancamentos: lista.length,
      total: Math.round(lista.reduce((s, g) => s + g.valor, 0) * 100) / 100,
      periodo_inicio: datas[0],
      periodo_fim: datas[datas.length - 1],
      created_by: primeiro.created_by ?? primeiro.pago_por ?? null,
      created_at: lista.map((g) => g.created_at!).sort()[0],
    };
  });
}
