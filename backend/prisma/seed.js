import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.supplier.count();
  if (existing > 0) {
    console.log(`Seed skipped – already have ${existing} suppliers`);
    return;
  }

  const egger = await prisma.supplier.create({
    data: {
      name: "Egger",
      code: "EGGER",
      email: "objednavky@egger.com",
      note: "Desky a hrany",
    },
  });

  const blum = await prisma.supplier.create({
    data: {
      name: "Blum",
      code: "BLUM",
      email: "info@blum.com",
      note: "Kovani - panty, pojezdy, tip-on",
    },
  });

  const hettich = await prisma.supplier.create({
    data: {
      name: "Hettich",
      code: "HETTICH",
      email: "info@hettich.com",
      note: "Kovani - alternativni rada",
    },
  });

  await prisma.material.createMany({
    data: [
      {
        name: "Egger W1000 ST9 Bila",
        code: "W1000-ST9-18",
        thickness: 18,
        grain: false,
        pricePerM2: 420,
        supplierId: egger.id,
      },
      {
        name: "Egger H3131 ST12 Dub",
        code: "H3131-ST12-18",
        thickness: 18,
        grain: true,
        pricePerM2: 580,
        supplierId: egger.id,
      },
      {
        name: "HDF zadni stena",
        code: "HDF-3",
        thickness: 3,
        grain: false,
        pricePerM2: 95,
        supplierId: egger.id,
      },
    ],
  });

  await prisma.edge.createMany({
    data: [
      {
        name: "ABS Bila 23x1",
        code: "ABS-W1000-23x1",
        thickness: 1,
        color: "W1000",
        pricePerM: 8.5,
        supplierId: egger.id,
      },
      {
        name: "ABS Dub 23x1",
        code: "ABS-H3131-23x1",
        thickness: 1,
        color: "H3131",
        pricePerM: 12,
        supplierId: egger.id,
      },
    ],
  });

  await prisma.hardware.createMany({
    data: [
      {
        type: "hinge",
        name: "CLIP top Blumotion 110 nalozeny",
        supplierCode: "71B3550",
        supplierId: blum.id,
        params: { overlay: "full", softClose: true, cupSize: 35, openingAngle: 110 },
        price: 145,
        specUrl: "https://www.blum.com",
      },
      {
        type: "hinge",
        name: "CLIP top Blumotion 110 polonalozeny",
        supplierCode: "71B3650",
        supplierId: blum.id,
        params: { overlay: "half", softClose: true, cupSize: 35, openingAngle: 110 },
        price: 145,
      },
      {
        type: "tip_on",
        name: "TIP-ON pro dvirka",
        supplierCode: "956A1004",
        supplierId: blum.id,
        params: { forDoors: true },
        price: 89,
      },
      {
        type: "drawer_slide",
        name: "MOVENTO 500 N 40 kg",
        supplierCode: "760H5000S",
        supplierId: blum.id,
        params: { height: 28, length: 500, load: 40 },
        price: 620,
      },
      {
        type: "drawer_slide",
        name: "TANDEMBOX antaro vyska M 500",
        supplierCode: "552.55.550",
        supplierId: blum.id,
        params: { height: 83.5, length: 500, load: 30, system: "antaro" },
        price: 890,
      },
      {
        type: "hang_strip",
        name: "Zavesna lista Blum",
        supplierCode: "175H3100",
        supplierId: blum.id,
        params: { length_mm: 1000 },
        price: 75,
      },
      {
        type: "hinge",
        name: "Sensys 110 nalozeny s tlumenim",
        supplierCode: "9071205",
        supplierId: hettich.id,
        params: { overlay: "full", softClose: true, cupSize: 35, openingAngle: 110 },
        price: 132,
      },
      {
        type: "drawer_slide",
        name: "Quadro V6 Silent System 500",
        supplierCode: "9257569",
        supplierId: hettich.id,
        params: { height: 33, length: 500, load: 30 },
        price: 540,
      },
      {
        type: "handle_bar",
        name: "Uchytova lista 19 mm",
        supplierCode: "HANDLE-BAR-19",
        supplierId: hettich.id,
        params: { height_mm: 19 },
        price: 45,
      },
      {
        type: "rectification_strip",
        name: "Retifikacni lista",
        supplierCode: "RECT-STRIP",
        supplierId: hettich.id,
        params: {},
        price: 28,
      },
    ],
  });

  await prisma.cabinetTemplate.create({
    data: {
      name: "Spodni skrinka 1D",
      version: 1,
      rules: {
        parts: [
          { name: "top", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "bottom", width: "W", height: "D - back_offset", material: "corpus" },
          { name: "left", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "right", width: "H - 2*T", height: "D - back_offset", material: "corpus" },
          { name: "back", width: "W - 2*T", height: "H - 2*T", material: "back" },
          { name: "door", width: "W", height: "H", material: "front" },
        ],
        hardware_rules: [
          { type: "hinge", condition: "door_height <= 900", count: 2 },
          { type: "hinge", condition: "door_height > 900", count: 3 },
        ],
        defaults: {
          back_offset_overlaid_hdf: 0,
          back_offset_half_dado_hdf: 9,
          thickness_corpus: 18,
        },
      },
    },
  });

  console.log("Seed OK:", {
    suppliers: [egger.code, blum.code, hettich.code],
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
