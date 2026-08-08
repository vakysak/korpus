import { readCsv, parsePrice } from "./_csv.js";

export async function parse(filePath) {
  const rows = await readCsv(filePath, ";");
  const materials = [];

  for (const row of rows) {
    const code = row.Article || row.Artikelnummer || "";
    if (!code) continue;

    const thickness = parsePrice(row.Thickness || row["Stärke"] || "18");
    const isHdf = thickness <= 6;
    const unitRaw = (row.Unit || "").toLowerCase();
    const desc = (row.Description || row.Bezeichnung || "").toLowerCase();
    const isEdge = unitRaw.includes("bm") || desc.includes("edge") || desc.includes("hrana");

    materials.push({
      supplierCode: code,
      name: row.Description || row.Bezeichnung || code,
      category: isEdge ? "EDGE" : isHdf ? "HDF" : "BOARD",
      thickness,
      widthMm: parseInt(row.Width || row.Breite || "0", 10) || null,
      heightMm: parseInt(row.Length || row["Länge"] || "0", 10) || null,
      inStock: (row.Stock || row.Lager || "1") !== "0",
      price: parsePrice(row.Price || row.Preis || "0"),
      unit: isEdge ? "BM" : "M2",
    });
  }

  return { materials, hardware: [] };
}
