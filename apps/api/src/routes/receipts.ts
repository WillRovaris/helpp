import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { authGuard } from "../auth/authGuard.js";
import { extractAccessKeyFromQr, parseAccessKey } from "../fiscal/accessKey.js";
import { getFiscalProvider, UnsupportedStateError } from "../fiscal/registry.js";
import { FiscalParseError } from "../fiscal/types.js";
import { DuplicateReceiptError, importReceipt } from "../services/receiptService.js";

const importSchema = z.object({
  qrContent: z.string().min(10),
  html: z.string().min(50),
});

export async function receiptRoutes(app: FastifyInstance) {
  app.post("/api/receipts/import", { preHandler: authGuard }, async (request, reply) => {
    const body = importSchema.parse(request.body);

    let accessKey: string;
    try {
      accessKey = extractAccessKeyFromQr(body.qrContent);
    } catch (error) {
      return reply.status(422).send({ error: (error as Error).message });
    }

    const keyInfo = parseAccessKey(accessKey);

    try {
      const provider = getFiscalProvider(keyInfo.uf);
      const parsed = provider.parseHtml(body.html, accessKey);
      const result = await importReceipt(request.userId!, keyInfo.uf, parsed);
      return reply.send({
        receipt: {
          id: result.receipt.id,
          purchaseDate: result.receipt.purchaseDate,
          totalValue: result.receipt.totalValue,
        },
        establishment: result.establishment,
        items: result.items.map((item) => ({
          id: item.id,
          rawDescription: item.rawDescription,
          name: item.product.name,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          identified: item.product.identified,
        })),
      });
    } catch (error) {
      if (error instanceof DuplicateReceiptError) {
        return reply.status(409).send({ error: error.message });
      }
      if (error instanceof UnsupportedStateError) {
        return reply.status(422).send({ error: error.message });
      }
      if (error instanceof FiscalParseError) {
        // MVP: não persistimos a tentativa falha (ver nota em DECISIONS.md #2).
        // TODO: guardar body.html em algum lugar (fila de revisão) para ajustar o parser de SC.
        request.log.error({ uf: error.uf, htmlLength: body.html.length }, error.message);
        return reply.status(422).send({ error: "Não conseguimos ler os dados dessa nota automaticamente. Tente escanear novamente." });
      }
      throw error;
    }
  });

  app.get("/api/receipts", { preHandler: authGuard }, async (request, reply) => {
    const receipts = await db.receipt.findMany({
      where: { userId: request.userId! },
      orderBy: { purchaseDate: "desc" },
      include: { establishment: true, items: true },
    });
    return reply.send(receipts);
  });

  app.get("/api/receipts/:id", { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const receipt = await db.receipt.findFirst({
      where: { id, userId: request.userId! },
      include: { establishment: true, items: { include: { product: true } } },
    });
    if (!receipt) return reply.status(404).send({ error: "Nota não encontrada." });
    return reply.send(receipt);
  });
}
