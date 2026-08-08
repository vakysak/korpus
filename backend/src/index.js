import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "korpus", db: true });
  } catch (err) {
    res.status(503).json({ ok: false, service: "korpus", db: false, error: String(err.message) });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "Korpus API",
    version: "0.1.0",
    docs: {
      health: "GET /health",
      suppliers: "GET /api/suppliers",
      materials: "GET /api/materials",
      edges: "GET /api/edges",
      hardware: "GET /api/hardware",
      templates: "GET /api/templates",
      orders: "GET|POST /api/orders",
    },
  });
});

app.get("/api/suppliers", async (_req, res) => {
  const data = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  res.json(data);
});

app.get("/api/materials", async (_req, res) => {
  const data = await prisma.material.findMany({
    include: { supplier: true },
    orderBy: { name: "asc" },
  });
  res.json(data);
});

app.get("/api/edges", async (_req, res) => {
  const data = await prisma.edge.findMany({
    include: { supplier: true },
    orderBy: { name: "asc" },
  });
  res.json(data);
});

app.get("/api/hardware", async (req, res) => {
  const where = req.query.type ? { type: String(req.query.type) } : {};
  const data = await prisma.hardware.findMany({
    where,
    include: { supplier: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  res.json(data);
});

app.get("/api/templates", async (_req, res) => {
  const data = await prisma.cabinetTemplate.findMany({ orderBy: { name: "asc" } });
  res.json(data);
});

app.get("/api/orders", async (_req, res) => {
  const data = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(data);
});

app.post("/api/orders", async (req, res) => {
  const { name, customer, status } = req.body ?? {};
  const data = await prisma.order.create({
    data: {
      name: name ?? null,
      customer: customer ?? null,
      status: status ?? "draft",
    },
  });
  res.status(201).json(data);
});

app.get("/api/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { template: true, material: true, handle: true, bomItems: true },
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
