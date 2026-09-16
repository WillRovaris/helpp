// Normalização baseada em regras (DECISIONS.md #6). Nunca sobrescreve o dado
// original — sempre parte de raw_description e produz um normalized_name novo.

const ABBREVIATIONS: Record<string, string> = {
  REFR: "Refrigerante",
  REFRIG: "Refrigerante",
  BISC: "Biscoito",
  RECH: "Recheado",
  CHOC: "Chocolate",
  LT: "Litro",
  UHT: "UHT",
  INT: "Integral",
  DESN: "Desnatado",
  PET: "",
  SAB: "Sabão",
  DETERG: "Detergente",
  ARR: "Arroz",
  FEIJ: "Feijão",
  ACUC: "Açúcar",
  OL: "Óleo",
  MANT: "Manteiga",
  MARG: "Margarina",
  IOG: "Iogurte",
  QJ: "Queijo",
  PRES: "Presunto",
  PAP: "Papel",
  HIG: "Higiênico",
};

const CONTENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|un|und|kg\b)/i;

export interface NormalizedProduct {
  normalizedName: string;
  contentValue?: number;
  contentUnit?: string;
}

export function normalizeProductName(rawDescription: string): NormalizedProduct {
  const tokens = rawDescription
    .trim()
    .split(/\s+/)
    .map((token) => {
      const upper = token.toUpperCase().replace(/[^\wÀ-Ú]/g, "");
      if (upper in ABBREVIATIONS) return ABBREVIATIONS[upper];
      return token;
    })
    .filter((token) => token.length > 0);

  const expanded = tokens.join(" ").replace(/\s+/g, " ").trim();

  const titled = expanded
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

  const contentMatch = rawDescription.match(CONTENT_PATTERN);
  const contentValue = contentMatch ? Number(contentMatch[1].replace(",", ".")) : undefined;
  const contentUnit = contentMatch ? contentMatch[2].toLowerCase() : undefined;

  return {
    normalizedName: titled || rawDescription,
    contentValue,
    contentUnit,
  };
}

/**
 * Preço por unidade padrão (kg ou litro) para comparação justa entre embalagens
 * de tamanhos diferentes (seção 9 do briefing).
 */
export function calculateUnitPrice(totalPrice: number, contentValue?: number, contentUnit?: string): number | null {
  if (!contentValue || contentValue <= 0) return null;

  const unit = contentUnit?.toLowerCase();
  if (unit === "g") return (totalPrice / contentValue) * 1000; // -> preço/kg
  if (unit === "ml") return (totalPrice / contentValue) * 1000; // -> preço/l
  if (unit === "kg" || unit === "l") return totalPrice / contentValue;
  return null;
}
