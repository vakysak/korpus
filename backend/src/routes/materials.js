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
    if (req.query.category) where.category = String(req.query.category).toUpperCase();
    if (req.query.supplierId) where.supplierId = Number(req.query.supplierId);

    const materials = await prisma.material.findMany({
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
      materials.map((m) => ({
        id: m.id,
        supplierCode: m.supplierCode,
        name: m.name,
        category: m.category,
        thickness: Number(m.thickness),
        widthMm: m.widthMm,
        heightMm: m.heightMm,
        supplier: m.supplier,
        price: m.priceListItems[0] ? Number(m.priceListItems[0].price) : null,
        unit: m.priceListItems[0]?.unit ?? null,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
