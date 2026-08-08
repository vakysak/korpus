import { readCsv, parsePrice } from "./_csv.js";

export async function parse(filePath) {
  const rows = await readCsv(filePath, ";");
  const hardware = [];

  for (const row of rows) {
    const code = row.ArtNr || row.ItemCode || row.kod || "";
    if (!code) continue;

    const rawType = (row.ProductGroup || row.Skupina || "").toLowerCase();
    const type = rawType.includes("hinge") || rawType.includes("pant")
      ? "HINGE"
      : rawType.includes("slide") || rawType.includes("výsuv") || rawType.includes("vysuv")
        ? "DRAWER_SLIDE"
        : rawType.includes("handle") || rawType.includes("úchytka") || rawType.includes("uchytka")
          ? "HANDLE"
          : "OTHER";

    hardware.push({
      supplierCode: code,
      name: row.Description || row.Popis || code,
      type,
      packQty: parseInt(row.PackQty || row["Balení"] || row.Baleni || "1", 10) || 1,
      inStock: (row.Stock || row.Sklad || "1") !== "0",
      price: parsePrice(row.Price || row.Cena || "0"),
      unit: "PC",
    });
  }

  return { materials: [], hardware };
}
