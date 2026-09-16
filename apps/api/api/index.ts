import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/app.js";

// A instância é criada uma vez e reaproveitada entre invocações "quentes"
// da função (buildApp já cacheia internamente).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await buildApp();
  app.server.emit("request", req, res);
}
