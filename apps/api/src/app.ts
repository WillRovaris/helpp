import Fastify, { type FastifyInstance } from "fastify";
import { authRoutes } from "./routes/auth.js";
import { receiptRoutes } from "./routes/receipts.js";
import { productRoutes } from "./routes/products.js";

let appInstance: FastifyInstance | null = null;

/**
 * Cria (ou reaproveita, entre invocações "quentes" de uma função serverless)
 * a instância do Fastify, sem chamar .listen() — quem decide como servir é
 * quem importa isso: src/index.ts (dev local) ou api/index.ts (Vercel).
 */
export async function buildApp(): Promise<FastifyInstance> {
  if (appInstance) return appInstance;

  const app = Fastify({ logger: true });

  // Precisa vir ANTES dos .register() — por causa do encapsulamento de plugins
  // do Fastify, um errorHandler definido depois de registrar as rotas não
  // captura erros lançados dentro delas (bug real encontrado e reproduzido
  // isoladamente: sem isso, um ZodError vira 500 cru do Fastify em vez do
  // 400 com mensagem amigável).
  app.setErrorHandler((error, _request, reply) => {
    if (error.name === "ZodError") {
      return reply.status(400).send({ error: "Dados inválidos.", details: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Erro interno." });
  });

  app.get("/", async () => ({ ok: true, service: "helpp-api" }));
  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(receiptRoutes);
  await app.register(productRoutes);

  await app.ready();
  appInstance = app;
  return app;
}
