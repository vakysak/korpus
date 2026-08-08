import fs from "node:fs";
import readline from "node:readline";

export async function readCsv(filePath, delimiter = ";") {
  const rows = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    // strip BOM
    const clean = line.replace(/^\uFEFF/, "");
    const cols = clean.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!headers) {
      headers = cols;
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export function parsePrice(raw) {
  return parseFloat(String(raw || "0").replace(/\s/g, "").replace(",", "."));
}
