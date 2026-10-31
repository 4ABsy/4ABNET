import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const t = async (label, fn) => {
  const s = performance.now();
  await fn();
  console.log(label, Math.round(performance.now() - s), "ms");
};

await t("connect + first query", () => prisma.storeSetting.findMany());
for (let i = 0; i < 5; i++) await t(`findMany #${i + 1}`, () => prisma.storeSetting.findMany());
for (let i = 0; i < 3; i++) await t(`count #${i + 1}`, () => prisma.product.count());
await t("transaction batch (4 queries)", () =>
  prisma.$transaction([
    prisma.storeSetting.findMany(),
    prisma.category.findMany(),
    prisma.banner.findMany(),
    prisma.product.findMany(),
  ]),
);
await prisma.$disconnect();
