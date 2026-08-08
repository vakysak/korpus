import { readCsv, parsePrice } from "./_csv.js";

export async function parse(filePath) {
  const rows = await readCsv(filePath, ",");
  const materials = [];
  const hardware = [];

  for (const row of rows) {
    const code = row.item_code || row.code || "";
    const name = row.description || row.name || code;
    const price = parsePrice(row.price || "0");
    const type = (row.type || "").toLowerCase();
    if (!code) continue;

    if (type.includes("hinge") || type.includes("slide") || type.includes("handle")) {
      hardware.push({
        supplierCode: code,
        name,
        type: type.includes("hinge")
          ? "HINGE"
          : type.includes("slide")
            ? "DRAWER_SLIDE"
            : type.includes("handle")
              ? "HANDLE"
              : "OTHER",
        packQty: parseInt(row.pack_qty || "1", 10) || 1,
        inStock: (row.in_stock || "1") !== "0",
        price,
        unit: "PC",
      });
    } else {
      materials.push({
        supplierCode: code,
        name,
        category: type.includes("hdf") ? "HDF" : type.includes("edge") ? "EDGE" : "BOARD",
        thickness: parsePrice(row.thickness || "18"),
        widthMm: parseInt(row.width || "0", 10) || null,
        heightMm: parseInt(row.length || "0", 10) || null,
        inStock: (row.in_stock || "1") !== "0",
        price,
        unit: type.includes("edge") ? "BM" : "M2",
      });
    }
  }

  return { materials, hardware };
}
