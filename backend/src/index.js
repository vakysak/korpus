import "dotenv/config";
import express from "express";
import { prisma } from "./db.js";
import bomRoutes from "./routes/bom.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use("/api", bomRoutes);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "korpus", db: true, version: "0.3.0" });
  } catch (err) {
    res.status(503).json({ ok: false, service: "korpus", db: false, error: String(err.message) });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "Korpus API",
    version: "0.3.0",
    docs: {
      health: "GET /health",
      suppliers: "GET /api/suppliers",
      materials: "GET /api/materials",
      hardware: "GET /api/hardware",
      prices: "GET /api/prices",
      templates: "GET /api/templates",
      customers: "GET|POST /api/customers",
      orders: "GET|POST /api/orders",
      orderItems: "POST /api/orders/:id/items",
      bom: "GET|POST /api/orders/:id/bom",
    },
  });
});

app.get("/api/suppliers", async (_req, res) => {
  res.json(await prisma.supplier.findMany({ where: { active: true }, orderBy: { priority: "asc" } }));
});

app.get("/api/materials", async (req, res) => {
  const where = { active: true };
  if (req.query.category) where.category = String(req.query.category).toUpperCase();
  res.json(
    await prisma.material.findMany({
      where,
      include: { supplier: true },
      orderBy: { name: "asc" },
    }),
  );
});

app.get("/api/hardware", async (req, res) => {
  const where = { active: true };
  if (req.query.type) where.type = String(req.query.type).toUpperCase();
  res.json(
    await prisma.hardware.findMany({
      where,
      include: { supplier: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  );
});

app.get("/api/prices", async (_req, res) => {
  const now = new Date();
  res.json(
    await prisma.priceListItem.findMany({
      where: {
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      include: { supplier: true, material: true, hardware: true },
      orderBy: { validFrom: "desc" },
    }),
  );
});

app.get("/api/templates", async (_req, res) => {
  res.json(await prisma.cabinetTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }));
});

app.get("/api/customers", async (_req, res) => {
  res.json(await prisma.customer.findMany({ orderBy: { name: "asc" } }));
});

app.post("/api/customers", async (req, res) => {
  const { name, email, phone, note } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name je povinne" });
  const data = await prisma.customer.create({
    data: { name, email: email ?? null, phone: phone ?? null, note: note ?? null },
  });
  res.status(201).json(data);
});

app.get("/api/orders", async (_req, res) => {
  res.json(
    await prisma.order.findMany({
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    }),
  );
});

app.post("/api/orders", async (req, res) => {
  const { customerId, note, status } = req.body ?? {};
  const data = await prisma.order.create({
    data: {
      customerId: customerId != null ? Number(customerId) : null,
      note: note ?? null,
      status: status ? String(status).toUpperCase() : "DRAFT",
    },
  });
  res.status(201).json(data);
});

app.get("/api/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          template: true,
          materialCorpus: true,
          materialBack: true,
          materialFront: true,
          bomItems: true,
        },
      },
    },
  });
  if (!data) return res.status(404).json({ error: "Order not found" });
  res.json(data);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`korpus listening on ${port}`);
});
