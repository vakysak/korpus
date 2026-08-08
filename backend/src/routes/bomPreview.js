import { Router } from "express";
import { prisma } from "../db.js";
import { computeBom } from "../bom/engine.js";
import { computeUpperCabinet } from "../bom/parts/upperCabinet.js";
import { advise } from "../ai/advisor.js";

const router = Router();

function asBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

router.post("/preview", async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      templateId,
      widthMm,
      heightMm,
      depthMm,
      backType,
      materialId,
      materialBackId,
      materialFrontId,
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

    let bom;
    if (template.rules?.engine === "upperCabinet") {
      bom = await computeUpperCabinet({
        W: Number(widthMm),
        H: Number(heightMm),
        D: Number(depthMm),
        materialCorpus: corpus,
        materialBack: back,
        materialFront: front,
        backType: backType ?? "OVERLAID_HDF",
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
        bottomRailLedType: bottomRailLedType ?? "CORNER_OVERLAY",
        bottomRailLedColor: bottomRailLedColor ?? null,
        bottomRailLedControl: bottomRailLedControl ?? null,
        doorType: doorType ?? "HANDLE",
        handleId: handleId ? Number(handleId) : null,
        handleBarHeight: Number(handleBarHeight ?? 0),
        hingeOverride: hingeOverride != null && hingeOverride !== "" ? Number(hingeOverride) : null,
      });
    } else {
      bom = await computeBom(template, {
        widthMm: Number(widthMm),
        heightMm: Number(heightMm),
        depthMm: Number(depthMm),
        backType: backType ?? "OVERLAID_HDF",
        materialMap: { corpus, back, front },
      });
    }

    const advice = await advise("bom_preview", { bom, template });
    res.json({ bom, advice });
  } catch (err) {
    console.error("BOM preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
