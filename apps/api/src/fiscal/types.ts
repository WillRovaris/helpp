export interface ParsedEstablishment {
  cnpj: string;
  legalName: string;
  tradeName?: string;
  address?: string;
  city?: string;
  state: string;
  zipCode?: string;
}

export interface ParsedItem {
  rawDescription: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  gtin?: string;
  ncm?: string;
  cest?: string;
}

export interface ParsedReceipt {
  accessKey: string;
  establishment: ParsedEstablishment;
  purchaseDate: Date;
  totalValue: number;
  items: ParsedItem[];
}

/**
 * Parser de HTML da página de consulta pública da NFC-e de uma UF específica.
 * O fetch da página acontece na WebView do app (ver DECISIONS.md #2) — aqui só
 * entra o HTML já renderizado, e sai a nota estruturada.
 */
export interface FiscalDataProvider {
  readonly uf: string;
  parseHtml(html: string, accessKey: string): ParsedReceipt;
}

export class FiscalParseError extends Error {
  constructor(
    message: string,
    public readonly uf: string,
  ) {
    super(message);
    this.name = "FiscalParseError";
  }
}
