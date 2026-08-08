import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const templates = await prisma.cabinetTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, version: true, rules: true, createdAt: true },
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const template = await prisma.cabinetTemplate.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!template) return res.status(404).json({ error: "Sablona nenalezena" });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
