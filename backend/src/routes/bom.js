import { Router } from "express";
import { prisma } from "../db.js";
import { computeBom } from "../bom/engine.js";

const router = Router();

/** POST /api/orders/:id/items */
router.post("/orders/:id/items", async (req, res) => {
  const orderId = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: "Objednavka nenalezena" });

  const {
    templateId,
    widthMm,
    heightMm,
    depthMm,
    materialId,
    materialBackId,
    materialFrontId,
    backType = "OVERLAID_HDF",
    qty = 1,
  } = req.body ?? {};

  if (!templateId || !widthMm || !heightMm || !depthMm || !materialId || !materialBackId || !materialFrontId) {
    return res.status(400).json({
      error: "Vyzadovano: templateId, widthMm, heightMm, depthMm, materialId, materialBackId, materialFrontId",
    });
  }

  const item = await prisma.orderItem.create({
    data: {
      orderId,
      templateId: Number(templateId),
      widthMm: Number(widthMm),
      heightMm: Number(heightMm),
      depthMm: Number(depthMm),
      materialId: Number(materialId),
      materialBackId: Number(materialBackId),
      materialFrontId: Number(materialFrontId),
      backType: String(backType).toUpperCase(),
      qty: Number(qty) || 1,
    },
    include: {
      template: true,
      materialCorpus: true,
      materialBack: true,
      materialFront: true,
    },
  });

  res.status(201).json(item);
});

/** POST /api/orders/:id/bom */
router.post("/orders/:id/bom", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const persist = req.body?.persist === true;
    const backTypeOverride = req.body?.backType;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            template: true,
            materialCorpus: true,
            materialBack: true,
            materialFront: true,
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: "Objednavka nenalezena" });
    if (!order.items.length) return res.status(400).json({ error: "Objednavka nema polozky" });

    const results = [];
    for (const item of order.items) {
      const bom = await computeBom(item.template, {
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        depthMm: item.depthMm,
        backType: backTypeOverride || item.backType,
        materialMap: {
          corpus: item.materialCorpus,
          back: item.materialBack,
          front: item.materialFront,
        },
      });

      if (persist) {
        await prisma.bomItem.deleteMany({ where: { orderItemId: item.id } });
        await prisma.bomItem.createMany({
          data: [
            ...bom.parts.map((p) => ({
              orderItemId: item.id,
              partName: p.partName,
              partType: p.partType,
              widthMm: p.widthMm,
              heightMm: p.heightMm,
              thickness: p.thickness,
              qty: p.qty * item.qty,
              unitPrice: p.unitPrice,
              totalPrice: p.totalPrice != null ? p.totalPrice * item.qty : null,
            })),
            ...bom.hardware.map((h) => ({
              orderItemId: item.id,
              hardwareId: h.hardwareId,
              partName: h.partName,
              partType: "HARDWARE",
              qty: h.qty * item.qty,
              unitPrice: h.unitPrice,
              totalPrice: h.totalPrice != null ? h.totalPrice * item.qty : null,
            })),
          ],
        });
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            snapshotBom: {
              ...bom,
              computedAt: new Date().toISOString(),
              templateVersion: item.template.version,
            },
          },
        });
      }

      results.push({
        itemId: item.id,
        templateName: item.template.name,
        dimensions: `${item.widthMm}x${item.heightMm}x${item.depthMm}`,
        ...bom,
      });
    }

    res.json({ orderId, persist, bom: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/orders/:id/bom */
router.get("/orders/:id/bom", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      include: { bomItems: true, template: true },
    });
    if (!items.length) return res.status(404).json({ error: "Zadne polozky" });
    res.json({ orderId, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
