import { readCsv, parsePrice } from "./_csv.js";

const TYPE_MAP = {
  hinge: "HINGE",
  pant: "HINGE",
  slide: "DRAWER_SLIDE",
  "výsuv": "DRAWER_SLIDE",
  vysuv: "DRAWER_SLIDE",
  handle: "HANDLE",
  "úchytka": "HANDLE",
  uchytka: "HANDLE",
};

function detectType(row) {
  const raw = (row.type || row.typ || row.category || row.kategorie || "").toLowerCase();
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (raw.includes(key)) return val;
  }
  return "OTHER";
}

export async function parse(filePath) {
  const rows = await readCsv(filePath, ";");
  const hardware = [];

  for (const row of rows) {
    const code = row.Article || row.ItemNo || row.kod || row["kód"] || "";
    if (!code) continue;
    hardware.push({
      supplierCode: code,
      name: row.Description || row.Popis || row.name || code,
      type: detectType(row),
      packQty: parseInt(row.PackQty || row.baleni || row["balení"] || "1", 10) || 1,
      inStock: (row.Stock || row.sklad || "1") !== "0",
      price: parsePrice(row.Price || row.cena || "0"),
      unit: "PC",
    });
  }

  return { materials: [], hardware };
}
