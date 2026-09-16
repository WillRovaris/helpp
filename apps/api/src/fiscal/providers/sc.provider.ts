import * as cheerio from "cheerio";
import type { FiscalDataProvider, ParsedEstablishment, ParsedItem, ParsedReceipt } from "../types.js";
import { FiscalParseError } from "../types.js";

/**
 * Validado contra uma nota real de SC em 15/09/2026 (KOCH HIPERMERCADO,
 * Tubarão/SC). A página de resultado (tax.NET/Sat.DFe.NFCe.Web) usa uma
 * tabela `#tabResult` com uma <tr id="Item + N"> por produto e classes fixas
 * (`.txtTit`, `.Rqtd`, `.RUN`, `.RvlUnit`, `.valor`), e um bloco `#totalNota`
 * com `<div id="linhaTotal"><label>...</label><span class="totalNumb">`.
 *
 * Os seletores abaixo usam essa estrutura real como caminho principal. As
 * funções heurísticas (baseadas em texto, não em classes) ficam como reserva
 * caso a SEFAZ mude o layout — nesse caso o parsing ainda tenta extrair algo
 * em vez de falhar direto.
 */

function parseBrNumber(text: string): number | null {
  const withoutCurrency = text.trim().replace(/^R\$\s*/i, "");
  // uma célula "numérica" não deve conter letras (ex: "2L PET" não é um número,
  // mesmo contendo o dígito 2) — só dígitos, separadores e o prefixo de moeda "R$".
  if (/[A-Za-zÀ-ÿ]/.test(withoutCurrency)) return null;

  const cleaned = withoutCurrency.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  // formato brasileiro: milhar com ponto, decimal com vírgula
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Remove um rótulo conhecido (ex: "Qtde.:", "Vl. Unit.:") do início do texto. */
function stripLabel(text: string, label: RegExp): string {
  return text.replace(label, "").trim();
}

function findValueNearLabel($: cheerio.CheerioAPI, labels: string[]): string | null {
  const bodyText = $("body").text();
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]{2,120})`, "i");
    const match = bodyText.match(regex);
    if (match) return match[match.length - 1].trim();
  }
  return null;
}

function extractEstablishmentPrecise($: cheerio.CheerioAPI): ParsedEstablishment | null {
  const container = $(".txtCenter").first();
  if (container.length === 0) return null;

  const legalName = container.find(".txtTopo").first().text().trim();
  const textBlocks = container.children(".text");
  if (!legalName || textBlocks.length < 2) return null;

  const cnpjBlock = textBlocks.eq(0).text();
  const cnpjMatch = cnpjBlock.match(/[\d./-]{14,18}/);
  const cnpj = cnpjMatch ? cnpjMatch[0].replace(/\D/g, "") : "";
  if (!cnpj) return null;

  const addressParts = textBlocks
    .eq(1)
    .text()
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : undefined;
  const address = addressParts.length > 2 ? addressParts.slice(0, -2).join(", ") : addressParts[0];

  return { cnpj, legalName, address, city, state: "SC" };
}

function extractEstablishmentHeuristic($: cheerio.CheerioAPI): ParsedEstablishment {
  const bodyText = $("body").text();

  const cnpjMatch = bodyText.match(/CNPJ[:\s]*([\d./-]{14,18})/i) ?? bodyText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  const cnpj = cnpjMatch ? (cnpjMatch[1] ?? cnpjMatch[0]) : "";
  if (!cnpj) {
    throw new FiscalParseError("Não foi possível localizar o CNPJ do estabelecimento no HTML.", "SC");
  }

  const legalName =
    findValueNearLabel($, ["Raz(ã|a)o Social", "Nome\\s*/\\s*Raz(ã|a)o Social", "Emitente"]) ?? "Estabelecimento não identificado";

  const address = findValueNearLabel($, ["Endere[cç]o"]) ?? undefined;
  const city = findValueNearLabel($, ["Munic[ií]pio", "Cidade"]) ?? undefined;

  return {
    cnpj: cnpj.replace(/\D/g, ""),
    legalName: legalName.trim(),
    address,
    city,
    state: "SC",
  };
}

function extractEstablishment($: cheerio.CheerioAPI): ParsedEstablishment {
  return extractEstablishmentPrecise($) ?? extractEstablishmentHeuristic($);
}

function extractTotalValuePrecise($: cheerio.CheerioAPI): number | null {
  let total: number | null = null;
  $("#totalNota #linhaTotal, #linhaTotal").each((_, el) => {
    const $el = $(el);
    const label = $el.find("label").first().text();
    if (/valor a pagar/i.test(label)) {
      total = parseBrNumber($el.find(".totalNumb").first().text());
    }
  });
  return total;
}

function extractTotalValue($: cheerio.CheerioAPI): number {
  const precise = extractTotalValuePrecise($);
  if (precise != null) return precise;

  const raw = findValueNearLabel($, ["Valor a pagar", "Valor Total( da Nota)?", "Valor total R\\$"]);
  const value = raw ? parseBrNumber(raw) : null;
  if (value == null) {
    throw new FiscalParseError("Não foi possível localizar o valor total da nota no HTML.", "SC");
  }
  return value;
}

function extractPurchaseDate($: cheerio.CheerioAPI): Date {
  const bodyText = $("body").text();
  // ex: "Emissão: 08/08/2026 20:04:31"
  const match = bodyText.match(/(\d{2})\/(\d{2})\/(\d{4})\D{0,10}(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  const dateOnly = bodyText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateOnly) {
    const [, day, month, year] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date();
}

function extractItemsPrecise($: cheerio.CheerioAPI): ParsedItem[] {
  const items: ParsedItem[] = [];

  $("#tabResult tr[id^='Item']").each((_, row) => {
    const $row = $(row);
    const firstTd = $row.find("td").eq(0);

    const rawDescription = firstTd.find(".txtTit").first().text().trim();
    if (!rawDescription) return;

    const quantity = parseBrNumber(stripLabel(firstTd.find(".Rqtd").text(), /Qtde\.?:?/i)) ?? 1;
    const unit = stripLabel(firstTd.find(".RUN").text(), /UN:?/i) || undefined;
    const unitPrice = parseBrNumber(stripLabel(firstTd.find(".RvlUnit").text(), /Vl\.?\s*Unit\.?:?/i)) ?? 0;
    const totalPrice = parseBrNumber($row.find("td").eq(1).find(".valor").first().text()) ?? unitPrice * quantity;

    items.push({ rawDescription, quantity, unit, unitPrice, totalPrice, discount: 0 });
  });

  return items;
}

/**
 * Heurística de itens (reserva): percorre todas as <tr> do documento e mantém
 * as que parecem uma linha de produto (descrição em texto + pelo menos duas
 * colunas numéricas). Usada só se `extractItemsPrecise` não achar nada —
 * ex: layout mudou ou a página não é a de resultado (ainda no captcha).
 */
function extractItemsHeuristic($: cheerio.CheerioAPI): ParsedItem[] {
  const items: ParsedItem[] = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => $(cell).text().trim())
      .get()
      .filter((text) => text.length > 0);

    if (cells.length < 3) return;

    const numericCells = cells.filter((c) => parseBrNumber(c) != null && /\d/.test(c));
    if (numericCells.length < 2) return;

    const description = cells.find((c) => parseBrNumber(c) == null && c.length > 2);
    if (!description) return;

    const numbers = numericCells.map((c) => parseBrNumber(c) as number);
    const totalPrice = numbers[numbers.length - 1];
    const unitPrice = numbers.length >= 2 ? numbers[numbers.length - 2] : totalPrice;
    const quantity = numbers.length >= 3 ? numbers[0] : totalPrice / (unitPrice || 1);

    items.push({
      rawDescription: description,
      quantity: quantity || 1,
      unitPrice: unitPrice || totalPrice,
      totalPrice,
      discount: 0,
    });
  });

  return items;
}

function extractItems($: cheerio.CheerioAPI): ParsedItem[] {
  const precise = extractItemsPrecise($);
  return precise.length > 0 ? precise : extractItemsHeuristic($);
}

export const scProvider: FiscalDataProvider = {
  uf: "SC",
  parseHtml(html: string, accessKey: string): ParsedReceipt {
    const $ = cheerio.load(html);

    const establishment = extractEstablishment($);
    const totalValue = extractTotalValue($);
    const purchaseDate = extractPurchaseDate($);
    const items = extractItems($);

    if (items.length === 0) {
      throw new FiscalParseError(
        "Nenhum item foi reconhecido no HTML da nota. O layout pode ter mudado ou a página não é a de resultado (ex: ainda está no captcha).",
        "SC",
      );
    }

    return {
      accessKey,
      establishment,
      purchaseDate,
      totalValue,
      items,
    };
  },
};
