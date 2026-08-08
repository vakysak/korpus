import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { upsertMaterial, upsertHardware } from "../importers/catalog.js";
import * as demos from "../importers/parsers/demos.js";
import * as trust from "../importers/parsers/trust.js";
import * as egger from "../importers/parsers/egger.js";
import * as blum from "../importers/parsers/blum.js";
import * as hettich from "../importers/parsers/hettich.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../tmp/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const parsers = { demos, trust, egger, blum, hettich };

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".csv", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Nepodporovany format: ${ext}. Povoleno: ${allowed.join(", ")}`));
  },
});

const router = Router();

router.get("/suppliers", async (_req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      orderBy: { priority: "asc" },
      select: { id: true, code: true, name: true, priority: true },
    });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", async (_req, res) => {
  try {
    const logs = await prisma.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { supplier: { select: { code: true, name: true } } },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    const supplierCode = String(req.body.supplier || "").toLowerCase();
    if (!supplierCode) return res.status(400).json({ error: "Chybi parametr supplier" });

    const parser = parsers[supplierCode];
    if (!parser) {
      return res.status(400).json({
        error: `Neznamy dodavatel: ${supplierCode}`,
        available: Object.keys(parsers),
      });
    }
    if (!req.file) return res.status(400).json({ error: "Chybi soubor" });

    const supplier = await prisma.supplier.upsert({
      where: { code: supplierCode.toUpperCase() },
      update: {},
      create: { code: supplierCode.toUpperCase(), name: supplierCode, priority: 99 },
    });

    const { materials = [], hardware = [] } = await parser.parse(tmpPath);
    const validFrom = new Date();
    let matAdded = 0;
    let matUpdated = 0;
    let hwAdded = 0;
    let hwUpdated = 0;
    const errors = [];

    for (const item of materials) {
      try {
        const existing = await prisma.material.findUnique({
          where: {
            supplierId_supplierCode: { supplierId: supplier.id, supplierCode: item.supplierCode },
          },
        });
        await upsertMaterial(supplier.id, item, validFrom);
        existing ? matUpdated++ : matAdded++;
      } catch (err) {
        errors.push({ code: item.supplierCode, error: err.message });
      }
    }

    for (const item of hardware) {
      try {
        const existing = await prisma.hardware.findUnique({
          where: {
            supplierId_supplierCode: { supplierId: supplier.id, supplierCode: item.supplierCode },
          },
        });
        await upsertHardware(supplier.id, item, validFrom);
        existing ? hwUpdated++ : hwAdded++;
      } catch (err) {
        errors.push({ code: item.supplierCode, error: err.message });
      }
    }

    const totalRows = materials.length + hardware.length;
    const status =
      errors.length === totalRows && errors.length > 0
        ? "FAILED"
        : errors.length > 0
          ? "PARTIAL"
          : "OK";

    const log = await prisma.importLog.create({
      data: {
        supplierId: supplier.id,
        fileName: req.file.originalname,
        matAdded,
        matUpdated,
        hwAdded,
        hwUpdated,
        errorCount: errors.length,
        errors: errors.length ? errors : undefined,
        status,
      },
    });

    res.json({
      importId: log.id,
      supplier: supplier.code,
      status: log.status,
      matAdded,
      matUpdated,
      hwAdded,
      hwUpdated,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

router.post("/preview", upload.single("file"), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    const supplierCode = String(req.body.supplier || "").toLowerCase();
    const parser = parsers[supplierCode];
    if (!parser) return res.status(400).json({ error: `Neznamy dodavatel: ${supplierCode}` });
    if (!req.file) return res.status(400).json({ error: "Chybi soubor" });

    const { materials = [], hardware = [] } = await parser.parse(tmpPath);
    res.json({
      supplier: supplierCode.toUpperCase(),
      materialCount: materials.length,
      hardwareCount: hardware.length,
      materialSample: materials.slice(0, 5),
      hardwareSample: hardware.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message?.includes("Nepodporovany")) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: err.message || "Import failed" });
});

export default router;
