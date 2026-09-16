import { PrismaClient } from "@prisma/client";

// Evita criar um novo pool de conexões a cada reload (tsx watch) ou a cada
// invocação "quente" de função serverless — reaproveita a instância global.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
