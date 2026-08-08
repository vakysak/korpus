import { readCsv, parsePrice } from "./_csv.js";

const CATEGORY_MAP = {
  deska: "BOARD",
  hdf: "HDF",
  hrana: "EDGE",
  front: "FRONT",
  pant: "HINGE",
  vysuv: "DRAWER_SLIDE",
  "výsuv": "DRAWER_SLIDE",
  uchytka: "HANDLE",
  "úchytka": "HANDLE",
};

function detectCategory(row) {
  const raw = (row.kategorie || row.typ || row.Kategorie || row.Typ || "").toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (raw.includes(key)) return val;
  }
  return null;
}

function isHardware(category) {
  return ["HINGE", "DRAWER_SLIDE", "HANDLE", "SHELF_PIN", "OTHER"].includes(category);
}

export async function parse(filePath) {
  const rows = await readCsv(filePath, ";");
  const materials = [];
  const hardware = [];

  for (const row of rows) {
    const category = detectCategory(row);
    if (!category) continue;

    const price = parsePrice(row.cena || row.cena_bez_dph || row.Cena || "0");
    const code = row.kod || row["kód"] || row.sku || row.Kod || "";
    const name = row.nazev || row["název"] || row.popis || row.Nazev || code;
    if (!code) continue;

    if (isHardware(category)) {
      hardware.push({
        supplierCode: code,
        name,
        type: category,
        packQty: parseInt(row.baleni || row["balení"] || "1", 10) || 1,
        inStock: (row.sklad || row.dostupnost || "1") !== "0",
        price,
        unit: "PC",
      });
    } else {
      materials.push({
        supplierCode: code,
        name,
        category,
        thickness: parsePrice(row.tloustka || row["tloušťka"] || "18"),
        widthMm: parseInt(row.sirka || row["šířka"] || "0", 10) || null,
        heightMm: parseInt(row.delka || row["délka"] || "0", 10) || null,
        inStock: (row.sklad || row.dostupnost || "1") !== "0",
        price,
        unit: category === "EDGE" ? "BM" : "M2",
      });
    }
  }

  return { materials, hardware };
}
