// Leitura de extratos e faturas exportados pelos bancos: OFX (padrão de
// extrato — BB, Caixa, Bradesco, Nubank, C6, Digio) e CSV (planilha — fatura
// do Nubank, C6 etc.). O CSV não tem formato único: as colunas de data,
// descrição e valor são descobertas pelo nome do cabeçalho.
// Sem dependências de React Native, para poder testar no computador.

import { ehPlanilha, planilhaParaCSV } from "./planilha";

export interface LancamentoArquivo {
  /** Identificador estável do lançamento (FITID do OFX ou impressão digital). */
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  /** Valor com o sinal do arquivo (negativo = saída no extrato). */
  valor: number;
  parcela: string | null; // "2/10"
}

export interface ArquivoLido {
  formato: "ofx" | "csv" | "planilha" | "pdf";
  /** Palpite do tipo pelo conteúdo (OFX de cartão, ou CSV com cara de fatura). */
  pareceFatura: boolean;
  banco: string | null;
  lancamentos: LancamentoArquivo[];
}

/** Bytes → texto. Tenta UTF-8; se não for válido, usa Windows-1252 (comum em OFX de banco). */
export function decodificar(bytes: Uint8Array): string {
  let s = "";
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3; // BOM
  let utf8Valido = true;
  for (; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      s += String.fromCharCode(b);
      continue;
    }
    const n = b >= 0xf0 ? 3 : b >= 0xe0 ? 2 : b >= 0xc0 ? 1 : -1;
    // byte inválido para início de sequência, ou sequência cortada no fim do arquivo
    if (n < 0 || i + n > bytes.length - 1) {
      utf8Valido = false;
      break;
    }
    let cp = b & (n === 3 ? 0x07 : n === 2 ? 0x0f : 0x1f);
    for (let k = 1; k <= n; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) {
        utf8Valido = false;
        break;
      }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (!utf8Valido) break;
    s += String.fromCodePoint(cp);
    i += n;
  }
  if (utf8Valido) return s;

  const CP1252: Record<number, string> = { 0x80: "€", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x96: "–", 0x97: "—" };
  let t = "";
  for (let j = 0; j < bytes.length; j++) {
    const b = bytes[j];
    t += b >= 0x80 && b < 0xa0 ? (CP1252[b] ?? " ") : String.fromCharCode(b);
  }
  return t;
}

/** "R$ 1.234,56", "-12.50", "1,234.56", "(10,00)" → número. null se não for número. */
export function lerNumero(texto: string): number | null {
  let t = texto.trim().replace(/R\$|US\$|\s/gi, "");
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (t.endsWith("-")) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith("-")) {
    negativo = !negativo;
    t = t.slice(1);
  } else if (t.startsWith("+")) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t)) return null;
  const ultimaVirgula = t.lastIndexOf(",");
  const ultimoPonto = t.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    t = ultimaVirgula > ultimoPonto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  }
  const n = Number(t);
  if (!isFinite(n)) return null;
  return negativo ? -n : n;
}

/** dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, aaaa-mm-dd, aaaammdd(hhmmss...) → YYYY-MM-DD. */
export function lerData(texto: string, anoPadrao?: number): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) [a, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = t.match(/^(\d{4})(\d{2})(\d{2})/))) [a, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) [d, m, a] = [+r[1], +r[2], +r[3] < 100 ? 2000 + +r[3] : +r[3]];
  else if ((r = t.match(/^(\d{1,2})\/(\d{1,2})$/)) && anoPadrao) [d, m, a] = [+r[1], +r[2], anoPadrao];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(a, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Garante ids únicos quando o mesmo lançamento aparece repetido no arquivo (ex.: 2 cafés iguais no dia). */
function idsUnicos(lista: Omit<LancamentoArquivo, "id">[], base: (l: Omit<LancamentoArquivo, "id">) => string, fixos?: (string | null)[]): LancamentoArquivo[] {
  const contagem = new Map<string, number>();
  return lista.map((l, i) => {
    const fixo = fixos?.[i];
    let id = fixo || base(l);
    const n = contagem.get(id) ?? 0;
    contagem.set(id, n + 1);
    if (n > 0) id += `#${n + 1}`;
    return { ...l, id };
  });
}

export function detectarParcela(desc: string): string | null {
  const m = desc.match(/(?:parc(?:ela)?\.?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  if (!m) return null;
  const [p, t] = [+m[1], +m[2]];
  return p >= 1 && t >= 2 && p <= t && t <= 48 ? `${p}/${t}` : null;
}

// ---------------------------------------------------------------- OFX

export function lerOFX(texto: string): ArquivoLido {
  const tag = (bloco: string, nome: string): string | null => {
    const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : null;
  };
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const fitids: (string | null)[] = [];
  const lista: Omit<LancamentoArquivo, "id">[] = [];
  for (const b of blocos) {
    const data = lerData(tag(b, "DTPOSTED") ?? "");
    const valor = lerNumero(tag(b, "TRNAMT") ?? "");
    if (!data || valor == null) continue;
    const memo = tag(b, "MEMO") ?? "";
    const nome = tag(b, "NAME") ?? "";
    const descricao = (memo && nome && !memo.includes(nome) ? `${nome} ${memo}` : memo || nome || "Lançamento").replace(/\s+/g, " ").trim();
    const fitid = tag(b, "FITID");
    fitids.push(fitid ? `ofx:${fitid}` : null);
    lista.push({ data, descricao, valor, parcela: detectarParcela(descricao) });
  }
  const org = tag(texto, "ORG") ?? tag(texto, "BANKID");
  return {
    formato: "ofx",
    pareceFatura: /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(texto),
    banco: org,
    lancamentos: idsUnicos(lista, (l) => `ofx:${l.data}:${l.valor.toFixed(2)}:${normalizar(l.descricao)}`, fitids),
  };
}

// ---------------------------------------------------------------- CSV

function separarLinhaCSV(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      campos.push(atual.trim());
      atual = "";
    } else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

function acharColuna(cab: string[], preferidas: RegExp[], evitar?: RegExp): number {
  for (const re of preferidas) {
    const i = cab.findIndex((c) => re.test(c) && !(evitar && evitar.test(c)));
    if (i >= 0) return i;
  }
  return -1;
}

export function lerCSV(texto: string): ArquivoLido {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  // Separador: o que mais aparece nas primeiras linhas.
  const amostra = linhas.slice(0, 5).join("\n");
  const sep = [";", ",", "\t"].map((s) => ({ s, n: amostra.split(s).length })).sort((a, b) => b.n - a.n)[0].s;

  // Cabeçalho: primeira linha (até a 15ª) que tenha uma coluna de data e uma de valor
  // (ou colunas separadas de crédito e débito, como no extrato do Bradesco).
  let iCab = -1;
  let cab: string[] = [];
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const c = separarLinhaCSV(linhas[i], sep).map(normalizar);
    const temValor = c.some((x) => /(valor|amount|value|quantia)/.test(x)) || (c.some((x) => /^credito/.test(x)) && c.some((x) => /^debito/.test(x)));
    if (c.some((x) => /^(data|date)\b/.test(x)) && temValor) {
      iCab = i;
      cab = c;
      break;
    }
  }
  if (iCab < 0) throw new Error("Não encontrei as colunas de data e valor neste arquivo.");

  const cData = acharColuna(cab, [/data de compra/, /^data$/, /^date$/, /^data/, /^date/]);
  const cDesc = acharColuna(cab, [/descri/, /^titulo|^title/, /estabelecimento/, /historico/, /lancamento/, /identificador/]);
  // BB e outros: "Lançamento" (tipo) + "Detalhes" (para quem / onde) em colunas separadas.
  const cDetalhe = acharColuna(cab, [/^detalhe/, /complemento/, /favorecido/]);
  const cValor = acharColuna(cab, [/valor.*r\$/, /^valor$/, /^amount$/, /^valor/, /amount|value/], /us\$|dolar|cotacao|saldo/);
  const cCredito = acharColuna(cab, [/^credito/]);
  const cDebito = acharColuna(cab, [/^debito/]);
  const cParcela = acharColuna(cab, [/parcela/, /installment/]);
  const cId = acharColuna(cab, [/^identificador$/, /^id$/]);
  if (cData < 0 || (cValor < 0 && (cCredito < 0 || cDebito < 0))) throw new Error("Não encontrei as colunas de data e valor neste arquivo.");

  /** Valor da linha: coluna única, ou crédito (entra, +) e débito (sai, −) separados. */
  const valorDaLinha = (c: string[]): number | null => {
    if (cValor >= 0) return lerNumero(c[cValor] ?? "");
    const cred = lerNumero(c[cCredito] ?? "") ?? 0;
    const deb = lerNumero(c[cDebito] ?? "") ?? 0;
    return cred - Math.abs(deb);
  };

  const anoAtual = new Date().getFullYear();
  const lista: Omit<LancamentoArquivo, "id">[] = [];
  const ids: (string | null)[] = [];
  for (const linha of linhas.slice(iCab + 1)) {
    const c = separarLinhaCSV(linha, sep);
    const data = lerData(c[cData] ?? "", anoAtual);
    // Linhas sem data válida (cabeçalho repetido, "Total", avisos do banco) são puladas.
    const valor = valorDaLinha(c);
    if (!data || valor == null || valor === 0) continue;
    const detalhe = cDetalhe >= 0 && cDetalhe !== cDesc ? (c[cDetalhe] ?? "").trim() : "";
    const descricao = [cDesc >= 0 ? c[cDesc] : "", detalhe].filter(Boolean).join(" - ") || "Lançamento";
    const parcelaCol = cParcela >= 0 ? (c[cParcela] ?? "").trim() : "";
    const parcela = parcelaCol && parcelaCol.toLowerCase() !== "única" ? detectarParcela(parcelaCol) : detectarParcela(descricao);
    ids.push(cId >= 0 && c[cId] && cId !== cDesc ? `csv:${c[cId]}` : null);
    lista.push({ data, descricao: descricao.replace(/\s+/g, " ").trim(), valor, parcela });
  }

  // Fatura de cartão costuma ter coluna de parcela, ou cabeçalho "title/amount" (Nubank).
  const pareceFatura = cParcela >= 0 || cab.includes("title") || cab.some((c) => /final do cartao|nome no cartao/.test(c));
  return {
    formato: "csv",
    pareceFatura,
    banco: null,
    lancamentos: idsUnicos(lista, (l) => `csv:${l.data}:${l.valor.toFixed(2)}:${normalizar(l.descricao)}${l.parcela ? ":" + l.parcela : ""}`, ids),
  };
}

// ---------------------------------------------------------------- PDF
// O texto do PDF é extraído no celular (pdf.js numa WebView) e chega aqui já
// separado em linhas. Um lançamento é uma linha que começa com data e tem valor.

export function ehPDF(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

const RE_DINHEIRO = /(?:R\$\s*)?\(?-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?\(?[+-]\)?|\s?[CD]\b)?/g;

const MESES_ABREV: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

/** Rodapé/cabeçalho repetido nas páginas (não faz parte de nenhum lançamento). */
const RE_RODAPE = /tem alguma d[uú]vida|ouvidoria|extrato gerado|metropolitanas|dispon[ií]veis em|atendimento 24h|valores em r\$|^\d+ de \d+$|asseguramos|nos responsabilizamos|saldo l[ií]quido corresponde/i;

/**
 * Extrato "agrupado por dia" (ex.: Nubank em PDF): a data vem como título
 * ("21 SET 2026"), seguida de "Total de entradas"/"Total de saídas" e dos
 * lançamentos daquele bloco, cuja descrição pode continuar nas linhas de baixo.
 */
function lerPDFAgrupadoPorDia(linhas: string[]): Omit<LancamentoArquivo, "id">[] {
  const lista: Omit<LancamentoArquivo, "id">[] = [];
  let data: string | null = null;
  let sinal = 0; // +1 entradas, -1 saídas
  let ultimo: Omit<LancamentoArquivo, "id"> | null = null;
  let continuacoes = 0;

  for (const bruta of linhas) {
    let linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (RE_RODAPE.test(linha)) {
      ultimo = null;
      continue;
    }
    const mData = linha.match(/^(\d{1,2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]* (\d{4})\b\s*/i);
    if (mData) {
      const mes = MESES_ABREV[mData[2].toLowerCase()];
      data = `${mData[3]}-${String(mes).padStart(2, "0")}-${mData[1].padStart(2, "0")}`;
      linha = linha.slice(mData[0].length);
      ultimo = null;
    }
    const nl = normalizar(linha);
    if (/^total de entradas/.test(nl)) {
      sinal = 1;
      ultimo = null;
      continue;
    }
    if (/^total de saidas/.test(nl)) {
      sinal = -1;
      ultimo = null;
      continue;
    }
    if (/^saldo/.test(nl) || /^rendimento/.test(nl)) {
      ultimo = null;
      continue;
    }
    if (!linha) continue;

    const mValor = linha.match(/(\d{1,3}(?:\.\d{3})*,\d{2})$/);
    if (mValor && data && sinal) {
      const valor = lerNumero(mValor[1]);
      if (valor == null || valor === 0) continue;
      const descricao = linha.slice(0, linha.length - mValor[0].length).trim() || "Lançamento";
      ultimo = { data, descricao, valor: sinal * valor, parcela: null };
      lista.push(ultimo);
      continuacoes = 0;
    } else if (ultimo && continuacoes < 3) {
      // continuação da descrição (nome/banco na linha de baixo)
      ultimo.descricao = `${ultimo.descricao} ${linha}`;
      continuacoes++;
    }
  }
  return lista;
}

export function lerLinhasPDF(linhas: string[]): ArquivoLido {
  const textoTodo = normalizar(linhas.join(" "));
  const temSaldo = /saldo/.test(textoTodo);
  const anoPadrao = (() => {
    const m = textoTodo.match(/\b(20\d{2})\b/);
    return m ? Number(m[1]) : new Date().getFullYear();
  })();
  const pareceFatura = /fatura|cartao de credito|limite (total|disponivel)|vencimento da fatura/.test(textoTodo) && !/extrato de conta|conta corrente/.test(textoTodo);

  const lista: Omit<LancamentoArquivo, "id">[] = [];
  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    const mData = linha.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+/);
    if (!mData) continue;
    const data = lerData(mData[1], anoPadrao);
    if (!data) continue;
    const resto = linha.slice(mData[0].length);
    if (/^saldo|saldo (anterior|do dia|final)|s a l d o/i.test(resto)) continue;

    const valores = [...resto.matchAll(RE_DINHEIRO)].map((m) => ({ texto: m[0], pos: m.index ?? 0 }));
    if (!valores.length) continue;
    // Com coluna de saldo, o último número da linha é o saldo; o valor vem antes dele.
    const alvo = temSaldo && valores.length >= 2 ? valores[valores.length - 2] : valores[valores.length - 1];
    const t = alvo.texto.trim();
    let valor = lerNumero(t.replace(/\(?[+-]\)?$|\s?[CD]$/, "").replace(/^\(|\)$/g, ""));
    if (valor == null || valor === 0) continue;
    valor = Math.abs(valor);
    const saida = /\(-\)$|-\)?$|\sD$|^\(.*\)$|^-/.test(t);
    const entrada = /\(\+\)$|\+$|\sC$/.test(t);
    const descricao = resto
      .slice(0, valores[0].pos)
      .replace(/\b\d{5,}\b/g, " ") // nº de documento
      .replace(/\s+/g, " ")
      .trim() || "Lançamento";
    // Sem sinal no PDF: entrada se a descrição disser (recebido, salário, depósito...); senão, saída.
    const ehEntrada = entrada || (!saida && /receb|credito|deposito|salario|estorno|rendimento|resgate/i.test(normalizar(descricao)));
    // Em fatura de cartão, compra é positiva (como no CSV) e pagamento/estorno negativo.
    const sinal = pareceFatura ? (ehEntrada || /pagamento|estorno/i.test(descricao) ? -1 : 1) : ehEntrada ? 1 : -1;
    lista.push({ data, descricao, valor: sinal * valor, parcela: detectarParcela(descricao) });
  }
  // Formato alternativo (data como título do dia): usa o que encontrar mais lançamentos.
  const agrupado = lerPDFAgrupadoPorDia(linhas);
  const escolhida = agrupado.length > lista.length ? agrupado : lista;
  if (!escolhida.length) throw new Error("Não encontrei lançamentos (linhas com data e valor) neste PDF.");
  return {
    formato: "pdf",
    pareceFatura,
    banco: /nubank|nu pagamentos/.test(textoTodo) ? "Nubank" : null,
    lancamentos: idsUnicos(escolhida, (l) => `pdf:${l.data}:${l.valor.toFixed(2)}:${normalizar(l.descricao)}`),
  };
}

export function lerArquivo(bytes: Uint8Array): ArquivoLido {
  if (ehPlanilha(bytes)) return { ...lerCSV(planilhaParaCSV(bytes)), formato: "planilha" };
  const texto = decodificar(bytes);
  if (/<OFX>|OFXHEADER/i.test(texto)) return lerOFX(texto);
  return lerCSV(texto);
}
