import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return reply.status(401).send({ error: "Token ausente." });
  }
  try {
    const payload = verifyToken(token);
    request.userId = payload.userId;
  } catch {
    return reply.status(401).send({ error: "Token inválido ou expirado." });
  }
}
