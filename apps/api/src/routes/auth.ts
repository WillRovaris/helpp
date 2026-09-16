import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/jwt.js";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (request, reply) => {
    const body = signupSchema.parse(request.body);

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "E-mail já cadastrado." });
    }

    const user = await db.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
      },
    });

    const token = signToken({ userId: user.id });
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email } });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.status(401).send({ error: "E-mail ou senha inválidos." });
    }

    const token = signToken({ userId: user.id });
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email } });
  });
}
