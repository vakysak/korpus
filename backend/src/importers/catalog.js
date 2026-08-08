import { prisma } from "../db.js";

export async function upsertMaterial(supplierId, item, validFrom) {
  const mat = await prisma.material.upsert({
    where: { supplierId_supplierCode: { supplierId, supplierCode: item.supplierCode } },
    update: {
      name: item.name,
      category: item.category,
      thickness: item.thickness,
      widthMm: item.widthMm ?? null,
      heightMm: item.heightMm ?? null,
      inStock: item.inStock,
      active: true,
    },
    create: {
      supplierId,
      supplierCode: item.supplierCode,
      name: item.name,
      category: item.category,
      thickness: item.thickness,
      widthMm: item.widthMm ?? null,
      heightMm: item.heightMm ?? null,
      inStock: item.inStock,
    },
  });

  await prisma.priceListItem.updateMany({
    where: { materialId: mat.id, validTo: null },
    data: { validTo: validFrom },
  });
  await prisma.priceListItem.create({
    data: {
      supplierId,
      materialId: mat.id,
      unit: item.unit,
      price: item.price,
      validFrom,
    },
  });
  return mat;
}

export async function upsertHardware(supplierId, item, validFrom) {
  const hw = await prisma.hardware.upsert({
    where: { supplierId_supplierCode: { supplierId, supplierCode: item.supplierCode } },
    update: {
      name: item.name,
      type: item.type,
      packQty: item.packQty,
      inStock: item.inStock,
      active: true,
    },
    create: {
      supplierId,
      supplierCode: item.supplierCode,
      name: item.name,
      type: item.type,
      packQty: item.packQty,
      inStock: item.inStock,
    },
  });

  await prisma.priceListItem.updateMany({
    where: { hardwareId: hw.id, validTo: null },
    data: { validTo: validFrom },
  });
  await prisma.priceListItem.create({
    data: {
      supplierId,
      hardwareId: hw.id,
      unit: item.unit,
      price: item.price,
      validFrom,
    },
  });
  return hw;
}
