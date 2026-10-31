import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// إعدادات محسنة للـ Connection Pooling للتعامل مع بيئة Serverless
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    // تحسين سرعة الاستجابة عبر تقليل وقت انتظار الاتصال
    // Prisma 5.x+ تدير هذا داخلياً عبر الرابط المزود بـ pgbouncer
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
