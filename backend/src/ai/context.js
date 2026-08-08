import { prisma } from "../db.js";

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Shared system memory for the AI lymph layer.
 * No GPT calls – read-only snapshot of suppliers, imports, prices.
 */
export async function getSystemContext() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  const [suppliers, recentImports, materialStats] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { priority: "asc" },
      select: { id: true, code: true, name: true, priority: true },
    }),
    prisma.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        supplierId: true,
        status: true,
        createdAt: true,
        matAdded: true,
        matUpdated: true,
      },
    }),
    prisma.priceListItem.groupBy({
      by: ["unit"],
      _avg: { price: true },
      _count: { price: true },
      where: {
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
    }),
  ]);

  _cache = { suppliers, recentImports, materialStats, fetchedAt: new Date() };
  _cacheTime = now;
  return _cache;
}

export async function getPriceRange(category) {
  const items = await prisma.priceListItem.findMany({
    where: {
      material: { category },
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    select: { price: true },
  });
  if (!items.length) return null;

  const prices = items.map((i) => Number(i.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  return { min, max, avg: Number(avg.toFixed(2)), count: prices.length };
}
