import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

async function recalcProductPartnerStock(productId: string | null | undefined, db: typeof basePrisma) {
  if (!productId) return;
  const total = await db.partnerStock.aggregate({
    where: { productId, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  await db.product.update({
    where: { id: productId },
    data: { partnerStock: total._sum.quantity ?? 0 },
  });
}

export const prisma = basePrisma.$extends({
  query: {
    partnerStock: {
      async create({ args, query }) {
        const result = await query(args);
        await recalcProductPartnerStock(result.productId, prisma);
        return result;
      },
      async createMany({ args, query }) {
        const result = await query(args);
        const ids =
          "data" in args
            ? (Array.isArray(args.data) ? args.data : [args.data]).map((d) => d.productId).filter(Boolean)
            : [];
        for (const productId of [...new Set(ids)]) {
          await recalcProductPartnerStock(productId, prisma);
        }
        return result;
      },
      async update({ args, query }) {
        const before = await prisma.partnerStock.findUnique({ where: args.where, select: { productId: true } });
        const result = await query(args);
        await recalcProductPartnerStock(before?.productId ?? result.productId, prisma);
        return result;
      },
      async updateMany({ args, query }) {
        const result = await query(args);
        const affected = await prisma.partnerStock.findMany({ where: args.where, select: { productId: true } });
        for (const productId of [...new Set(affected.map((a) => a.productId).filter(Boolean))]) {
          await recalcProductPartnerStock(productId, prisma);
        }
        return result;
      },
      async upsert({ args, query }) {
        const result = await query(args);
        await recalcProductPartnerStock(result.productId, prisma);
        return result;
      },
      async delete({ args, query }) {
        const before = await prisma.partnerStock.findUnique({ where: args.where, select: { productId: true } });
        const result = await query(args);
        await recalcProductPartnerStock(before?.productId, prisma);
        return result;
      },
      async deleteMany({ args, query }) {
        const affected = await prisma.partnerStock.findMany({ where: args.where, select: { productId: true } });
        const result = await query(args);
        for (const productId of [...new Set(affected.map((a) => a.productId).filter(Boolean))]) {
          await recalcProductPartnerStock(productId, prisma);
        }
        return result;
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}
