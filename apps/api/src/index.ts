import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = await buildApp();

app.listen({ port: env.port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API rodando na porta ${env.port}`);
});
