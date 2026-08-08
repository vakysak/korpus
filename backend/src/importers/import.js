#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { prisma } from "../db.js";
import { upsertMaterial, upsertHardware } from "./catalog.js";
import * as demos from "./parsers/demos.js";
import * as trust from "./parsers/trust.js";
import * as egger from "./parsers/egger.js";
import * as blum from "./parsers/blum.js";
import * as hettich from "./parsers/hettich.js";

const parsers = { demos, trust, egger, blum, hettich };

async function run(supplierCode, filePath) {
  const parser = parsers[supplierCode.toLowerCase()];
  if (!parser) {
    console.error(`Neznamy dodavatel: ${supplierCode}`);
    console.error(`Dostupni: ${Object.keys(parsers).join(", ")}`);
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`Soubor nenalezen: ${filePath}`);
    process.exit(1);
  }

  const supplier = await prisma.supplier.upsert({
    where: { code: supplierCode.toUpperCase() },
    update: {},
    create: { code: supplierCode.toUpperCase(), name: supplierCode, priority: 99 },
  });

  console.log(`Import: ${supplier.name} (id=${supplier.id})`);
  console.log(`Soubor: ${filePath}`);

  const { materials = [], hardware = [] } = await parser.parse(filePath);
  const validFrom = new Date();
  let matAdded = 0;
  let matUpdated = 0;
  let hwAdded = 0;
  let hwUpdated = 0;
  let errors = 0;

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
      console.error(`  Material ${item.supplierCode}: ${err.message}`);
      errors++;
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
      console.error(`  Hardware ${item.supplierCode}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Hotovo`);
  console.log(`  Materialy: +${matAdded} new, ~${matUpdated} updated`);
  console.log(`  Kovani:    +${hwAdded} new, ~${hwUpdated} updated`);
  if (errors) console.log(`  Chyby: ${errors}`);
  await prisma.$disconnect();
}

const program = new Command();
program
  .requiredOption("--supplier <code>", "Kod dodavatele (demos, trust, egger, blum, hettich)")
  .requiredOption("--file <path>", "Cesta k souboru ceniku")
  .parse(process.argv);

const opts = program.opts();
run(opts.supplier, path.resolve(opts.file)).catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
