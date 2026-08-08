import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { prisma } from "./db.js";
import bomPreviewRoutes from "./routes/bomPreview.js";
import importRoutes from "./routes/import.js";
import catalogRoutes from "./routes/catalog.js";
import materialsRoutes from "./routes/materials.js";
import hardwareRoutes from "./routes/hardware.js";
import ordersRoutes from "./routes/orders.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use("/api/bom", bomPreviewRoutes);
app.use("/api/import", importRoutes);
app.use("/api/templates", catalogRoutes);
app.use("/api/materials", materialsRoutes);
app.use("/api/hardware", hardwareRoutes);
app.use("/api/orders", ordersRoutes);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "korpus", db: true, version: "0.6.0" });
  } catch (err) {
    res.status(503).json({ ok: false, service: "korpus", db: false, error: String(err.message) });
  }
});

app.get("/api/suppliers", async (_req, res) => {
  res.json(await prisma.supplier.findMany({ where: { active: true }, orderBy: { priority: "asc" } }));
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.use(express.static(publicDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") return next();
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "UI not built" });
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`korpus listening on ${port}`);
});
