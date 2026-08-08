import { Router } from "express";
import { prisma } from "../db.js";
import { computeBom } from "../bom/engine.js";
import { advise } from "../ai/advisor.js";

const router = Router();

router.post("/preview", async (req, res) => {
  try {
    const {
      templateId,
      widthMm,
      heightMm,
      depthMm,
      backType,
      materialId,
      materialBackId,
      materialFrontId,
    } = req.body ?? {};

    const missing = [];
    if (!templateId) missing.push("templateId");
    if (!widthMm) missing.push("widthMm");
    if (!heightMm) missing.push("heightMm");
    if (!depthMm) missing.push("depthMm");
    if (!materialId) missing.push("materialId");
    if (!materialBackId) missing.push("materialBackId");
    if (!materialFrontId) missing.push("materialFrontId");
    if (missing.length) {
      return res.status(400).json({ error: `Chybi: ${missing.join(", ")}` });
    }

    const [template, corpus, back, front] = await Promise.all([
      prisma.cabinetTemplate.findUnique({ where: { id: Number(templateId) } }),
      prisma.material.findUnique({ where: { id: Number(materialId) } }),
      prisma.material.findUnique({ where: { id: Number(materialBackId) } }),
      prisma.material.findUnique({ where: { id: Number(materialFrontId) } }),
    ]);

    if (!template) return res.status(404).json({ error: "Sablona nenalezena" });
    if (!corpus) return res.status(404).json({ error: "Material korpusu nenalezen" });
    if (!back) return res.status(404).json({ error: "Material zad nenalezen" });
    if (!front) return res.status(404).json({ error: "Material frontu nenalezen" });

    const input = {
      widthMm: Number(widthMm),
      heightMm: Number(heightMm),
      depthMm: Number(depthMm),
      backType: backType ?? "OVERLAID_HDF",
      materialMap: { corpus, back, front },
    };

    const bom = await computeBom(template, input);
    const advice = await advise("bom_preview", { bom, input, template });

    res.json({ bom, advice });
  } catch (err) {
    console.error("BOM preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
