import { Router } from "express";
import { prisma } from "../db.js";
import { computeBom } from "../bom/engine.js";

const router = Router();

/**
 * Role materiálu nejsou ve schématu – mapování:
 * - corpus = OrderItem.material
 * - back   = body.materialBackId | materiál s kódem HDF-3 | thickness ≈ 3
 * - front  = body.materialFrontId | stejný jako corpus
 */
async function resolveMaterialMap(item, body = {}) {
  const corpus = item.material;
  if (!corpus) {
    throw Object.assign(new Error("Položka nemá corpus materiál (materialId)"), { status: 400 });
  }

  let back = null;
  if (body.materialBackId) {
    back = await prisma.material.findUnique({ where: { id: Number(body.materialBackId) } });
  }
  if (!back) {
    back =
      (await prisma.material.findFirst({ where: { code: "HDF-3" } })) ||
      (await prisma.material.findFirst({ where: { thickness: 3 } }));
  }
  if (!back) {
    throw Object.assign(new Error("Nenalezen materiál pro roli back (HDF)"), { status: 400 });
  }

  let front = corpus;
  if (body.materialFrontId) {
    front = await prisma.material.findUnique({ where: { id: Number(body.materialFrontId) } });
    if (!front) {
      throw Object.assign(new Error("materialFrontId nenalezen"), { status: 400 });
    }
  }

  return { corpus, back, front };
}

/** POST /api/orders/:id/items – přidá skříňku do zakázky */
router.post("/orders/:id/items", async (req, res) => {
  const orderId = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: "Objednávka nenalezena" });

  const {
    templateId,
    widthMm,
    heightMm,
    depthMm,
    materialId,
    backType = "overlaid_hdf",
    doorType = "none",
    handleId = null,
    quantity = 1,
  } = req.body ?? {};

  if (!templateId || !widthMm || !heightMm || !depthMm || !materialId) {
    return res.status(400).json({
      error: "Vyžadováno: templateId, widthMm, heightMm, depthMm, materialId",
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
      backType,
      doorType,
      handleId: handleId != null ? Number(handleId) : null,
      quantity: Number(quantity) || 1,
    },
    include: { template: true, material: true },
  });

  res.status(201).json(item);
});

/**
 * POST /api/orders/:id/bom
 * body: { backType?, materialBackId?, materialFrontId?, persist?: boolean }
 */
router.post("/orders/:id/bom", async (req, res) => {
  const orderId = Number(req.params.id);
  const body = req.body ?? {};
  const persist = Boolean(body.persist);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { template: true, material: true },
      },
    },
  });

  if (!order) return res.status(404).json({ error: "Objednávka nenalezena" });
  if (!order.items.length) {
    return res.status(400).json({ error: "Objednávka nemá žádné položky" });
  }

  try {
    const results = [];

    for (const item of order.items) {
      const materialMap = await resolveMaterialMap(item, body);
      const backType = body.backType || item.backType || "overlaid_hdf";

      const bom = computeBom(item.template, {
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        depthMm: item.depthMm,
        backType,
        materialMap,
      });

      if (persist) {
        await prisma.bomItem.deleteMany({ where: { orderItemId: item.id } });
        await prisma.bomItem.createMany({
          data: bom.parts.map((p) => ({
            orderItemId: item.id,
            partName: p.name,
            widthMm: p.widthMm,
            heightMm: p.heightMm,
            quantity: p.quantity * item.quantity,
            materialId: p.material?.id ?? item.materialId,
            grain: "none",
            note: null,
          })),
        });
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            snapshotBom: {
              parts: bom.parts,
              hardware: bom.hardware,
              warnings: bom.warnings,
              computedAt: new Date().toISOString(),
              templateVersion: item.template.version,
            },
          },
        });
      }

      results.push({
        itemId: item.id,
        templateName: item.template.name,
        templateVersion: item.template.version,
        dims: { widthMm: item.widthMm, heightMm: item.heightMm, depthMm: item.depthMm },
        backType,
        ...bom,
      });
    }

    res.json({ orderId, persist, bom: results });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || "BOM výpočet selhal" });
  }
});

export default router;
