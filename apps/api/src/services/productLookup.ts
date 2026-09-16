import { db } from "../db.js";
import { env } from "../env.js";
import { normalizeProductName } from "./normalization.js";
import type { ParsedItem } from "../fiscal/types.js";

interface CosmosLookupResult {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
}

/**
 * Busca dados externos por GTIN (DECISIONS.md #7). Implementação real pendente
 * de chave de API (COSMOS_API_KEY vazia por padrão) — quando configurada,
 * consultar https://cosmos.bluesoft.com.br/api-docs e mapear os campos.
 */
async function lookupExternalByGtin(gtin: string): Promise<CosmosLookupResult | null> {
  if (!env.cosmosApiKey) return null;

  try {
    const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${gtin}.json`, {
      headers: { "X-Cosmos-Token": env.cosmosApiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { description?: string; brand?: { name?: string }; gpc?: { description?: string }; thumbnail?: string };
    if (!data.description) return null;
    return {
      name: data.description,
      brand: data.brand?.name,
      category: data.gpc?.description,
      imageUrl: data.thumbnail,
    };
  } catch {
    return null; // não bloquear a importação da nota por falha de enriquecimento (seção 20)
  }
}

/**
 * Resolve (ou cria) o Product canônico para um item de nota. Prioridade:
 * 1) GTIN já conhecido na base interna
 * 2) GTIN em fonte externa (Cosmos)
 * 3) Cria um produto "não identificado" a partir da normalização por regras,
 *    sem bloquear a importação (seção 20).
 */
export async function resolveProduct(item: ParsedItem) {
  if (item.gtin) {
    const existing = await db.product.findUnique({ where: { gtin: item.gtin } });
    if (existing) return existing;
  }

  const normalized = normalizeProductName(item.rawDescription);

  if (item.gtin) {
    const external = await lookupExternalByGtin(item.gtin);
    if (external) {
      return db.product.create({
        data: {
          gtin: item.gtin,
          name: external.name,
          brand: external.brand,
          category: external.category,
          imageUrl: external.imageUrl,
          imageSource: external.imageUrl ? "cosmos" : null,
          contentValue: normalized.contentValue,
          contentUnit: normalized.contentUnit,
          identified: true,
        },
      });
    }
  }

  return db.product.create({
    data: {
      gtin: item.gtin,
      name: normalized.normalizedName,
      contentValue: normalized.contentValue,
      contentUnit: normalized.contentUnit,
      identified: false,
    },
  });
}
