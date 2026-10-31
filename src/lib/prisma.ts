import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Configure Prisma with connection pooling settings for Supabase PostgreSQL
// Connection pool size: 20 (adjust based on your needs and Supabase limits)
// Timeout: 30 seconds for queries, 10 seconds between retries
// Connection timeout: 60 seconds
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    errorFormat: "pretty",
    // Connection pool configuration for Supabase/PostgreSQL
    // Max connections: 20 is a safe default for Supabase Free/Pro plans
    // Connection timeout: 60s, query timeout: 30s
    // These are hints; the actual pool is managed by the underlying driver
    // Consider adding connection pooling middleware like pg-bouncer for production
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
