import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const priceWhere = {
  validFrom: { lte: new Date() },
  OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
};

router.get("/", async (req, res) => {
  try {
    const where = { active: true, inStock: true };
    if (req.query.type) where.type = String(req.query.type).toUpperCase();

    const hardware = await prisma.hardware.findMany({
      where,
      orderBy: [{ supplier: { priority: "asc" } }, { name: "asc" }],
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        priceListItems: {
          where: priceWhere,
          orderBy: { validFrom: "desc" },
          take: 1,
          select: { price: true, unit: true },
        },
      },
    });

    res.json(
      hardware.map((h) => ({
        id: h.id,
        supplierCode: h.supplierCode,
        name: h.name,
        type: h.type,
        packQty: h.packQty,
        supplier: h.supplier,
        price: h.priceListItems[0] ? Number(h.priceListItems[0].price) : null,
        unit: h.priceListItems[0]?.unit ?? null,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
