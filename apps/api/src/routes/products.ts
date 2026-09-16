import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { authGuard } from "../auth/authGuard.js";

const MIN_RECORDS_FOR_STATS = 1; // seção 16: evitar estatística sem dado suficiente; ajustar quando houver volume real

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products/search", { preHandler: authGuard }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ error: "Informe ao menos 2 caracteres para buscar." });
    }

    const products = await db.product.findMany({
      where: { name: { contains: q } },
      take: 20,
      include: {
        priceRecords: {
          orderBy: { purchaseDate: "desc" },
          take: 1,
        },
      },
    });

    return reply.send(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        contentValue: p.contentValue,
        contentUnit: p.contentUnit,
        imageUrl: p.imageUrl,
        lastPrice: p.priceRecords[0]?.price ?? null,
        lastUpdate: p.priceRecords[0]?.purchaseDate ?? null,
      })),
    );
  });

  app.get("/api/products/:id", { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return reply.status(404).send({ error: "Produto não encontrado." });

    const priceRecords = await db.priceRecord.findMany({
      where: { productId: id },
      orderBy: { purchaseDate: "desc" },
      include: { establishment: true },
      take: 100,
    });

    const byEstablishment = new Map<string, (typeof priceRecords)[number]>();
    for (const record of priceRecords) {
      if (!byEstablishment.has(record.establishmentId)) {
        byEstablishment.set(record.establishmentId, record);
      }
    }
    const currentPrices = [...byEstablishment.values()].sort((a, b) => a.price - b.price);

    return reply.send({
      product,
      hasEnoughData: priceRecords.length >= MIN_RECORDS_FOR_STATS,
      currentPrices: currentPrices.map((r) => ({
        establishment: { id: r.establishment.id, name: r.establishment.tradeName ?? r.establishment.legalName, city: r.establishment.city },
        price: r.price,
        unitPrice: r.unitPrice,
        purchaseDate: r.purchaseDate,
      })),
      history: priceRecords.map((r) => ({ price: r.price, unitPrice: r.unitPrice, purchaseDate: r.purchaseDate })),
    });
  });
}
