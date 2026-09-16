import { db } from "../db.js";
import type { ParsedReceipt } from "../fiscal/types.js";
import { calculateUnitPrice, normalizeProductName } from "./normalization.js";
import { resolveProduct } from "./productLookup.js";

export class DuplicateReceiptError extends Error {
  constructor() {
    super("Essa nota já foi adicionada.");
    this.name = "DuplicateReceiptError";
  }
}

export async function importReceipt(userId: string, uf: string, parsed: ParsedReceipt) {
  const existing = await db.receipt.findUnique({ where: { accessKey: parsed.accessKey } });
  if (existing) throw new DuplicateReceiptError();

  const establishment = await db.establishment.upsert({
    where: { cnpj: parsed.establishment.cnpj },
    update: {},
    create: {
      cnpj: parsed.establishment.cnpj,
      legalName: parsed.establishment.legalName,
      tradeName: parsed.establishment.tradeName,
      address: parsed.establishment.address,
      city: parsed.establishment.city,
      state: parsed.establishment.state,
      zipCode: parsed.establishment.zipCode,
    },
  });

  const receipt = await db.receipt.create({
    data: {
      userId,
      accessKey: parsed.accessKey,
      establishmentId: establishment.id,
      purchaseDate: parsed.purchaseDate,
      totalValue: parsed.totalValue,
      sourceUf: uf,
    },
  });

  const createdItems = [];
  for (const item of parsed.items) {
    const product = await resolveProduct(item);
    const normalized = normalizeProductName(item.rawDescription);
    const unitPrice = calculateUnitPrice(item.totalPrice, product.contentValue ?? normalized.contentValue, product.contentUnit ?? normalized.contentUnit) ?? item.unitPrice;

    const receiptItem = await db.receiptItem.create({
      data: {
        receiptId: receipt.id,
        productId: product.id,
        rawDescription: item.rawDescription,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount,
        totalPrice: item.totalPrice,
        ncm: item.ncm,
        cest: item.cest,
      },
    });

    await db.priceRecord.create({
      data: {
        productId: product.id,
        establishmentId: establishment.id,
        receiptId: receipt.id,
        price: item.totalPrice,
        quantity: item.quantity,
        unitPrice,
        purchaseDate: parsed.purchaseDate,
      },
    });

    createdItems.push({ ...receiptItem, product });
  }

  return { receipt, establishment, items: createdItems };
}
