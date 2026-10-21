// Planilhas do banco (.xlsx, .xls e o ".xls" que na verdade é uma tabela HTML,
// comum em extrato de banco) viram texto no formato CSV com ";", para passar
// pelo mesmo leitor de CSV. Datas e valores são lidos da célula (não do texto
// formatado), para não confundir dia/mês nem separador decimal.
import * as XLSX from "xlsx";

function celulaParaTexto(cel: XLSX.CellObject | undefined): string {
  if (!cel || cel.v == null) return "";
  if (cel.t === "n") {
    const v = cel.v as number;
    if (cel.z && XLSX.SSF.is_date(cel.z)) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
    }
    // sempre com 2 casas: "1.5" vira "1.50" (o leitor nunca confunde com milhar)
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (cel.t === "d" && cel.v instanceof Date) {
    const d = cel.v;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  return String(cel.w ?? cel.v).replace(/[;\r\n]+/g, " ").trim();
}

/** Converte a aba com mais linhas da planilha em texto CSV (separador ";"). */
export function planilhaParaCSV(bytes: Uint8Array): string {
  // raw: no ".xls" em HTML, não deixar a biblioteca "adivinhar" (ela leria 07/10 como 10 de julho e "200,00" como 20000).
  const livro = XLSX.read(bytes, { type: "array", cellDates: false, cellNF: true, raw: true });
  let melhor = "";
  let maisLinhas = -1;
  for (const nome of livro.SheetNames) {
    const aba = livro.Sheets[nome];
    if (!aba["!ref"]) continue;
    const faixa = XLSX.utils.decode_range(aba["!ref"]);
    const linhas: string[] = [];
    for (let r = faixa.s.r; r <= faixa.e.r; r++) {
      const campos: string[] = [];
      for (let c = faixa.s.c; c <= faixa.e.c; c++) campos.push(celulaParaTexto(aba[XLSX.utils.encode_cell({ r, c })]));
      if (campos.some((x) => x)) linhas.push(campos.join(";"));
    }
    if (linhas.length > maisLinhas) {
      maisLinhas = linhas.length;
      melhor = linhas.join("\n");
    }
  }
  return melhor;
}

/** Arquivo é planilha? (xlsx = zip "PK", xls = OLE, ou HTML com tabela). */
export function ehPlanilha(bytes: Uint8Array): boolean {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true; // PK (xlsx)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true; // xls antigo
  const inicio = String.fromCharCode(...Array.from(bytes.slice(0, 600))).toLowerCase();
  return /<table|<html/.test(inicio) && !/<ofx>/.test(inicio);
}
