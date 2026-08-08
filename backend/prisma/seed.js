import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Dodavatelé
  const demos = await prisma.supplier.upsert({
    where: { code: "DEMOS" },
    update: { name: "Demos", priority: 1, active: true },
    create: { code: "DEMOS", name: "Demos", priority: 1 },
  });
  await prisma.supplier.upsert({
    where: { code: "TRUST" },
    update: { name: "Trust", priority: 2 },
    create: { code: "TRUST", name: "Trust", priority: 2 },
  });
  await prisma.supplier.upsert({
    where: { code: "EGGER" },
    update: { name: "Egger", priority: 3 },
    create: { code: "EGGER", name: "Egger", priority: 3 },
  });
  const blum = await prisma.supplier.upsert({
    where: { code: "BLUM" },
    update: { name: "Blum", priority: 4 },
    create: { code: "BLUM", name: "Blum", priority: 4 },
  });
  await prisma.supplier.upsert({
    where: { code: "HETTICH" },
    update: { name: "Hettich", priority: 5 },
    create: { code: "HETTICH", name: "Hettich", priority: 5 },
  });

  const corpus = await prisma.material.upsert({
    where: { supplierId_supplierCode: { supplierId: demos.id, supplierCode: "DEMOS-D18-WHITE" } },
    update: { name: "Drevotriska 18mm bila", category: "BOARD", thickness: 18, widthMm: 2800, heightMm: 2070, inStock: true },
    create: {
      supplierId: demos.id,
      supplierCode: "DEMOS-D18-WHITE",
      name: "Drevotriska 18mm bila",
      category: "BOARD",
      thickness: 18,
      widthMm: 2800,
      heightMm: 2070,
      inStock: true,
    },
  });

  const back = await prisma.material.upsert({
    where: { supplierId_supplierCode: { supplierId: demos.id, supplierCode: "HDF-3" } },
    update: { name: "HDF zada 3mm", category: "HDF", thickness: 3, widthMm: 2800, heightMm: 2070, inStock: true },
    create: {
      supplierId: demos.id,
      supplierCode: "HDF-3",
      name: "HDF zada 3mm",
      category: "HDF",
      thickness: 3,
      widthMm: 2800,
      heightMm: 2070,
      inStock: true,
    },
  });

  const front = await prisma.material.upsert({
    where: { supplierId_supplierCode: { supplierId: demos.id, supplierCode: "DEMOS-D18-WHITE-FRONT" } },
    update: { name: "Front 18mm bila", category: "FRONT", thickness: 18, widthMm: 2800, heightMm: 2070, inStock: true },
    create: {
      supplierId: demos.id,
      supplierCode: "DEMOS-D18-WHITE-FRONT",
      name: "Front 18mm bila",
      category: "FRONT",
      thickness: 18,
      widthMm: 2800,
      heightMm: 2070,
      inStock: true,
    },
  });

  // Ceník – uzavři staré platnosti a vlož aktuální
  const now = new Date();
  for (const [materialId, price] of [
    [corpus.id, 320],
    [back.id, 85],
    [front.id, 320],
  ]) {
    await prisma.priceListItem.updateMany({
      where: { materialId, validTo: null },
      data: { validTo: now },
    });
    await prisma.priceListItem.create({
      data: { supplierId: demos.id, materialId, unit: "M2", price, validFrom: now },
    });
  }

  const hinge = await prisma.hardware.upsert({
    where: { supplierId_supplierCode: { supplierId: blum.id, supplierCode: "BLUM-71B3590" } },
    update: { name: "Blum Clip Top pant 110", type: "HINGE", packQty: 1, inStock: true, active: true },
    create: {
      supplierId: blum.id,
      supplierCode: "BLUM-71B3590",
      name: "Blum Clip Top pant 110",
      type: "HINGE",
      packQty: 1,
      inStock: true,
    },
  });

  await prisma.priceListItem.updateMany({
    where: { hardwareId: hinge.id, validTo: null },
    data: { validTo: now },
  });
  await prisma.priceListItem.create({
    data: { supplierId: blum.id, hardwareId: hinge.id, unit: "PC", price: 45, validFrom: now },
  });

  const defaults = {
    thickness_corpus: 18,
    back_offset_overlaid_hdf: 0,
    back_offset_half_dado_hdf: 9,
  };

  const templateDefs = [
    {
      name: "Spodni skrinka 1D",
      rules: {
        parts: [
          { name: "top", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "bottom", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "left", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "right", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "back", width: "W - 2*T", height: "H - 2*T", material: "back" },
          { name: "door", width: "W", height: "H", material: "front" },
        ],
        defaults,
        hardware_rules: [
          { type: "hinge", count: 2, condition: "door_height <= 900" },
          { type: "hinge", count: 3, condition: "door_height > 900" },
        ],
      },
    },
    {
      name: "Horni skrinka 1D",
      rules: {
        parts: [
          { name: "top", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "bottom", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "left", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "right", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "back", width: "W - 2*T", height: "H - 2*T", material: "back" },
          { name: "door", width: "W", height: "H", material: "front" },
        ],
        defaults,
        hardware_rules: [
          { type: "hinge", count: 2, condition: "door_height <= 600" },
          { type: "hinge", count: 3, condition: "door_height > 600" },
        ],
      },
    },
    {
      name: "Spodni skrinka 2D",
      rules: {
        parts: [
          { name: "top", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "bottom", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "left", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "right", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "middle", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "back", width: "W - 2*T", height: "H - 2*T", material: "back" },
          { name: "door_l", width: "W / 2", height: "H", material: "front" },
          { name: "door_r", width: "W / 2", height: "H", material: "front" },
        ],
        defaults,
        hardware_rules: [
          { type: "hinge", count: 4, condition: "door_height <= 900" },
          { type: "hinge", count: 6, condition: "door_height > 900" },
        ],
      },
    },
    {
      name: "Vitrina 1D sklo",
      rules: {
        parts: [
          { name: "top", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "bottom", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "left", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "right", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "back", width: "W - 2*T", height: "H - 2*T", material: "back" },
          { name: "door", width: "W - 4", height: "H - 4", material: "front" },
        ],
        defaults,
        hardware_rules: [
          { type: "hinge", count: 2, condition: "door_height <= 800" },
          { type: "hinge", count: 3, condition: "door_height > 800" },
        ],
      },
    },
  ];

  for (const def of templateDefs) {
    await prisma.cabinetTemplate.upsert({
      where: { name_version: { name: def.name, version: 1 } },
      update: { rules: def.rules, active: true },
      create: { name: def.name, version: 1, rules: def.rules },
    });
  }

  console.log("Seed OK", {
    suppliers: ["DEMOS", "TRUST", "EGGER", "BLUM", "HETTICH"],
    materials: [corpus.supplierCode, back.supplierCode, front.supplierCode],
    hinge: hinge.supplierCode,
    templates: templateDefs.map((t) => t.name),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
