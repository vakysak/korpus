import { Router } from "express";
import { prisma } from "../db.js";
import { advise } from "../ai/advisor.js";

const router = Router();

function bomToOrderItems(bom) {
  const items = [];

  for (const part of bom.parts ?? []) {
    items.push({
      partName: part.partName,
      partType: part.partType ?? "BOARD",
      materialId: part.materialId ?? part.material?.id ?? null,
      hardwareId: null,
      widthMm: part.widthMm ?? null,
      heightMm: part.heightMm ?? null,
      thickness: part.thickness ?? null,
      qty: part.qty ?? 1,
      unit: part.unit ?? "M2",
      unitPrice: part.unitPrice ?? 0,
      totalPrice: part.totalPrice ?? 0,
      supplierId: part.supplierId ?? null,
    });
  }

  for (const hw of bom.hardware ?? []) {
    items.push({
      partName: hw.partName,
      partType: "HARDWARE",
      materialId: null,
      hardwareId: hw.hardwareId ?? null,
      widthMm: null,
      heightMm: null,
      thickness: null,
      qty: hw.qty ?? 1,
      unit: hw.unit ?? "PC",
      unitPrice: hw.unitPrice ?? 0,
      totalPrice: hw.totalPrice ?? 0,
      supplierId: hw.supplierId ?? null,
    });
  }

  return items;
}

function toCsv(rows) {
  if (!rows.length) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(";"));
  }
  return `\uFEFF${lines.join("\n")}`;
}

const VALID_TRANSITIONS = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ORDERED", "CANCELLED"],
  ORDERED: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["DONE"],
  DONE: [],
  CANCELLED: [],
};

/** POST /api/orders – create from live BOM */
router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      templateId,
      widthMm,
      heightMm,
      depthMm,
      backType,
      bom,
      customerId,
      notes,
      shelfCount,
      visibleSideLeft,
      visibleSideRight,
      topRailEnabled,
      topRailOverhang,
      topRailLed,
      topRailLedColor,
      topRailLedControl,
      bottomRailEnabled,
      bottomRailLed,
      bottomRailLedType,
      bottomRailLedColor,
      bottomRailLedControl,
      doorType,
      handleId,
      handleBarHeight,
      hingeOverride,
    } = body;

    if (!bom) return res.status(400).json({ error: "Chybi bom" });
    if (!widthMm || !heightMm || !depthMm) {
      return res.status(400).json({ error: "Chybi rozmery" });
    }

    const orderItems = bomToOrderItems(bom);
    if (!orderItems.length) {
      return res.status(400).json({ error: "BOM nema polozky" });
    }

    const asBool = (v) => v === true || v === "true" || v === 1 || v === "1";

    const order = await prisma.order.create({
      data: {
        templateId: templateId != null ? Number(templateId) : null,
        customerId: customerId != null ? Number(customerId) : null,
        widthMm: Number(widthMm),
        heightMm: Number(heightMm),
        depthMm: Number(depthMm),
        backType: String(backType ?? "OVERLAID_HDF").toUpperCase(),
        totalPrice: bom.totalPrice ?? 0,
        notes: notes ?? null,
        status: "DRAFT",
        shelfCount: Number(shelfCount ?? 1),
        visibleSideLeft: asBool(visibleSideLeft),
        visibleSideRight: asBool(visibleSideRight),
        topRailEnabled: asBool(topRailEnabled),
        topRailOverhang: Number(topRailOverhang ?? 21),
        topRailLed: asBool(topRailLed),
        topRailLedColor: topRailLedColor ?? null,
        topRailLedControl: topRailLedControl ?? null,
        bottomRailEnabled: asBool(bottomRailEnabled),
        bottomRailLed: asBool(bottomRailLed),
        bottomRailLedType: bottomRailLedType ?? null,
        bottomRailLedColor: bottomRailLedColor ?? null,
        bottomRailLedControl: bottomRailLedControl ?? null,
        doorType: String(doorType ?? "HANDLE").toUpperCase(),
        handleId: handleId ? Number(handleId) : null,
        handleBarHeight: handleBarHeight != null ? Number(handleBarHeight) : null,
        hingeOverride: hingeOverride != null && hingeOverride !== "" ? Number(hingeOverride) : null,
        items: { create: orderItems },
      },
      include: {
        items: true,
        template: { select: { id: true, name: true } },
      },
    });

    advise("order_confirm", { order, bom }).catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/orders */
router.get("/", async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = String(status).toUpperCase();

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
        include: {
          template: { select: { name: true } },
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/orders/:id */
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        template: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            material: { select: { name: true, category: true, thickness: true, supplierCode: true } },
            hardware: { select: { name: true, type: true, supplierCode: true } },
            supplier: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ partType: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!order) return res.status(404).json({ error: "Objednavka nenalezena" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/orders/:id/status */
router.patch("/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status ?? "").toUpperCase();
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!order) return res.status(404).json({ error: "Objednavka nenalezena" });

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Prechod ${order.status} → ${status} neni povolen`,
        allowed,
      });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/orders/:id/export */
router.get("/:id/export", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        items: {
          include: {
            material: { select: { supplierCode: true, name: true, category: true } },
            hardware: { select: { supplierCode: true, name: true, type: true } },
            supplier: { select: { code: true, name: true } },
          },
        },
        template: { select: { name: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Objednavka nenalezena" });

    const supplierId = req.query.supplier ? Number(req.query.supplier) : null;
    const items = supplierId
      ? order.items.filter((i) => i.supplierId === supplierId)
      : order.items;

    const rows = items.map((i) => ({
      Kod: i.material?.supplierCode ?? i.hardware?.supplierCode ?? "",
      Nazev: i.material?.name ?? i.hardware?.name ?? i.partName,
      Typ: i.material?.category ?? i.hardware?.type ?? i.partType,
      "Sirka mm": i.widthMm ?? "",
      "Vyska mm": i.heightMm ?? "",
      "Tl. mm": i.thickness != null ? Number(i.thickness) : "",
      Mnozstvi: Number(i.qty),
      Jedn: i.unit,
      "Cena/jedn.": Number(i.unitPrice),
      "Celkem Kc": Number(i.totalPrice),
      Dodavatel: i.supplier?.name ?? "",
    }));

    const csv = toCsv(rows);
    const filename = `objednavka-${order.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
