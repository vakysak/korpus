import { prisma } from "../../db.js";

function areaM2(w, h) {
  return (w / 1000) * (h / 1000);
}

function stapleCount(dimensionMm) {
  const count = Math.floor(dimensionMm / 150);
  return dimensionMm % 150 > 0 ? count + 1 : count;
}

async function getPrice(materialId) {
  if (!materialId) return null;
  const item = await prisma.priceListItem.findFirst({
    where: {
      materialId,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: [{ validFrom: "desc" }],
    select: { price: true, unit: true },
  });
  return item ? { price: parseFloat(item.price), unit: item.unit } : null;
}

async function getHardwarePrice(hardwareId) {
  if (!hardwareId) return null;
  const item = await prisma.priceListItem.findFirst({
    where: {
      hardwareId,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: [{ validFrom: "desc" }],
    select: { price: true, unit: true },
  });
  return item ? { price: parseFloat(item.price), unit: item.unit } : null;
}

function makePart(name, type, w, h, thickness, material, priceData, qty = 1, edges = {}, notes = "") {
  const area = areaM2(w, h);
  const totalPrice = priceData
    ? parseFloat((area * priceData.price * qty).toFixed(2))
    : null;

  return {
    partName: name,
    partType: type,
    materialId: material?.id ?? null,
    supplierId: material?.supplierId ?? null,
    widthMm: Math.round(w),
    heightMm: Math.round(h),
    thickness: parseFloat(thickness),
    qty,
    unit: "M2",
    areaM2: parseFloat((area * qty).toFixed(4)),
    unitPrice: priceData?.price ?? null,
    totalPrice,
    edges,
    notes,
    material: material
      ? {
          id: material.id,
          name: material.name,
          category: material.category,
          supplierCode: material.supplierCode,
        }
      : null,
  };
}

function makeHardware(name, hw, qty, priceData, notes = "") {
  const totalPrice = priceData ? parseFloat((priceData.price * qty).toFixed(2)) : null;
  return {
    partName: name,
    partType: "HARDWARE",
    hardwareId: hw?.id ?? null,
    supplierId: hw?.supplierId ?? null,
    qty,
    unit: "PC",
    unitPrice: priceData?.price ?? null,
    totalPrice,
    notes,
    hardware: hw ? { id: hw.id, name: hw.name, type: hw.type, supplierCode: hw.supplierCode } : null,
  };
}

function calcBack(W, H, Tc, backType) {
  switch (backType) {
    case "OVERLAID_HDF":
      return { w: W - 0.5, h: H - 0.5, staples: true };
    case "HALF_DADO_HDF":
      return { w: W - 0.5, h: H - 0.5, staples: true };
    case "RECTIFICATION":
      return { w: W - 10, h: H - 7, staples: false, rectification: true };
    case "OVERLAID_SOLID":
      return { w: W - Tc, h: H - Tc, staples: false };
    case "DADO_SOLID":
      return { w: W - Tc, h: H - Tc, staples: false };
    default:
      return { w: W - 0.5, h: H - 0.5, staples: true };
  }
}

/**
 * Kompletni vzorce horne skrinky.
 */
export async function computeUpperCabinet(input) {
  const {
    W,
    H,
    D,
    materialCorpus,
    materialBack,
    materialFront,
    backType = "OVERLAID_HDF",
    shelfCount = 1,
    visibleSideLeft = false,
    visibleSideRight = false,
    topRailEnabled = false,
    topRailOverhang = 21,
    topRailLed = false,
    topRailLedColor = null,
    topRailLedControl = null,
    bottomRailEnabled = false,
    bottomRailLed = false,
    bottomRailLedType = "CORNER_OVERLAY",
    bottomRailLedColor = null,
    bottomRailLedControl = null,
    doorType = "HANDLE",
    handleId = null,
    handleBarHeight = 0,
    hingeOverride = null,
  } = input;

  const Tc = parseFloat(materialCorpus.thickness);
  const Tf = parseFloat(materialFront.thickness);

  const warnings = [];
  const parts = [];
  const hardware = [];

  const corpusPrice = await getPrice(materialCorpus.id);
  const backPrice = await getPrice(materialBack.id);
  const frontPrice = await getPrice(materialFront.id);

  if (!corpusPrice) warnings.push("Chybi cena korpusoveho materialu");
  if (!backPrice) warnings.push("Chybi cena materialu zad");
  if (!frontPrice) warnings.push("Chybi cena dvirkoviny");

  // ── Korpus ────────────────────────────────────────────────────────────────
  const bokW = D - Tc;
  const bokH = H - 2 * Tc;
  parts.push(
    makePart("bok", "BOARD", bokW, bokH, Tc, materialCorpus, corpusPrice, 2, {
      front: true,
      bottom: true,
    }, "predni + dolni hrana"),
  );

  const dnoW = W - 2 * Tc;
  const dnoH = D - Tc;
  parts.push(
    makePart("dno", "BOARD", dnoW, dnoH, Tc, materialCorpus, corpusPrice, 1, { front: true }, "predni hrana"),
  );
  parts.push(
    makePart("puda", "BOARD", dnoW, dnoH, Tc, materialCorpus, corpusPrice, 1, { front: true }, "predni hrana"),
  );

  const shelves = Number(shelfCount) || 0;
  if (shelves > 0) {
    parts.push(
      makePart(
        "police",
        "BOARD",
        W - 2 * Tc,
        D - Tc - 20,
        Tc,
        materialCorpus,
        corpusPrice,
        shelves,
        { front: true },
        "predni hrana",
      ),
    );
  }

  // ── Zada ──────────────────────────────────────────────────────────────────
  const backCalc = calcBack(W, H, Tc, String(backType).toUpperCase());
  parts.push({
    ...makePart(
      "zada",
      "BOARD",
      backCalc.w,
      backCalc.h,
      parseFloat(materialBack.thickness),
      materialBack,
      backPrice,
      1,
      {},
      String(backType),
    ),
    staples: backCalc.staples,
    stapleCount: backCalc.staples ? stapleCount(backCalc.w + backCalc.h) * 2 : 0,
    rectification: backCalc.rectification ?? false,
  });

  if (backCalc.rectification) {
    parts.push(
      makePart(
        "retifikacni_lista",
        "BOARD",
        Tc,
        backCalc.h,
        Tc,
        materialCorpus,
        corpusPrice,
        2,
        {},
        "retifikacni lista L/P",
      ),
    );
    parts.push(
      makePart(
        "lista_zaveseni",
        "BOARD",
        W - 2 * Tc,
        Tc,
        Tc,
        materialCorpus,
        corpusPrice,
        2,
        {},
        "lista na zaveseni",
      ),
    );
  }

  // ── Dvirka ────────────────────────────────────────────────────────────────
  const doorCount = W < 650 ? 1 : 2;
  const doorW = doorCount === 1 ? W - 0.6 : W / 2 - 0.6;
  const barH = Number(handleBarHeight) || 0;
  const doorH = doorType === "HANDLE_BAR" ? H - 0.6 - barH : H - 0.6;

  parts.push(
    makePart(
      "dvere",
      "FRONT",
      doorW,
      doorH,
      Tf,
      materialFront,
      frontPrice,
      doorCount,
      { front: true, back: true, left: true, right: true },
      "hrana kolem dokola",
    ),
  );

  const autoHingePerDoor = doorH < 1200 ? 2 : 3;
  const hingePerDoor = hingeOverride != null ? Number(hingeOverride) : autoHingePerDoor;
  const hingeCount = hingePerDoor * doorCount;

  const hinge = await prisma.hardware.findFirst({
    where: { type: "HINGE", inStock: true, active: true },
    orderBy: { supplier: { priority: "asc" } },
  });
  const hingePrice = await getHardwarePrice(hinge?.id);
  if (!hinge) warnings.push("Chybi pant v DB (typ HINGE)");
  hardware.push({
    ...makeHardware("pant", hinge, hingeCount, hingePrice),
    autoCount: autoHingePerDoor * doorCount,
    perDoor: hingePerDoor,
    doorCount,
  });

  if (doorType === "HANDLE" && handleId) {
    const handle = await prisma.hardware.findUnique({ where: { id: Number(handleId) } });
    const handlePrice = await getHardwarePrice(handle?.id);
    if (!handle) warnings.push("Chybi vybrana uchytka");
    else hardware.push(makeHardware("uchytka", handle, doorCount, handlePrice));
  }

  if (doorType === "TIP_ON") {
    const tipOn = await prisma.hardware.findFirst({
      where: {
        type: "OTHER",
        name: { contains: "tip", mode: "insensitive" },
        inStock: true,
        active: true,
      },
      orderBy: { supplier: { priority: "asc" } },
    });
    const tipOnPrice = await getHardwarePrice(tipOn?.id);
    if (!tipOn) warnings.push("Chybi tip-on v DB");
    hardware.push(makeHardware("tip_on", tipOn, doorCount, tipOnPrice));
  }

  if (doorType === "HANDLE_BAR" && barH > 0) {
    parts.push(
      makePart(
        "lista_uchytka",
        "FRONT",
        doorW,
        barH,
        Tf,
        materialFront,
        frontPrice,
        doorCount,
        { front: true, back: true, left: true, right: true },
        "lista uchytka – hrana kolem dokola",
      ),
    );
  }

  // ── Pohledovy bok ─────────────────────────────────────────────────────────
  const visibleSideCount = (visibleSideLeft ? 1 : 0) + (visibleSideRight ? 1 : 0);
  const overhang = Number(topRailOverhang) || 21;

  if (visibleSideCount > 0) {
    const sideLabel = [visibleSideLeft && "levy", visibleSideRight && "pravy"].filter(Boolean).join(" + ");
    parts.push(
      makePart(
        "pohledovy_bok",
        "FRONT",
        D + Tf,
        H + overhang,
        Tf,
        materialFront,
        frontPrice,
        visibleSideCount,
        { front: true, top: true, bottom: true },
        `pohledovy bok – ${sideLabel}`,
      ),
    );
  }

  // ── Horni rampa ───────────────────────────────────────────────────────────
  if (topRailEnabled) {
    const rampaH = overhang + 80;
    const rampaW = W + visibleSideCount * Tf;
    parts.push(
      makePart(
        "rampa_horni",
        "FRONT",
        rampaW,
        rampaH,
        Tf,
        materialFront,
        frontPrice,
        1,
        { bottom: true, left: true, right: true },
        topRailLed
          ? `horni rampa – LED ${topRailLedColor ?? ""} / ${topRailLedControl ?? ""}`
          : "horni rampa",
      ),
    );

    if (topRailLed) {
      const led = await findLedStrip();
      if (led) {
        const ledPrice = await getHardwarePrice(led.id);
        hardware.push({
          partName: "led_pasek_horni",
          partType: "HARDWARE",
          hardwareId: led.id,
          supplierId: led.supplierId,
          qty: parseFloat((rampaW / 1000).toFixed(3)),
          unit: "BM",
          unitPrice: ledPrice?.price ?? null,
          totalPrice: ledPrice
            ? parseFloat(((rampaW / 1000) * ledPrice.price).toFixed(2))
            : null,
          notes: `barva: ${topRailLedColor ?? "—"}, ovladani: ${topRailLedControl ?? "—"}`,
          hardware: { id: led.id, name: led.name, type: led.type, supplierCode: led.supplierCode },
        });
      } else {
        warnings.push("Chybi LED pasek v DB");
      }
    }
  }

  // ── Spodni rampa ──────────────────────────────────────────────────────────
  if (bottomRailEnabled) {
    const rampaSpodniW = W + visibleSideCount * Tf;
    parts.push(
      makePart(
        "rampa_spodni",
        "FRONT",
        rampaSpodniW,
        Tf,
        Tf,
        materialFront,
        frontPrice,
        1,
        { top: true, left: true, right: true },
        bottomRailLed
          ? `spodni rampa – LED ${bottomRailLedType} / ${bottomRailLedColor ?? ""}`
          : "spodni rampa",
      ),
    );

    if (bottomRailLed) {
      const led = await findLedStrip();
      if (led) {
        const ledPrice = await getHardwarePrice(led.id);
        hardware.push({
          partName: "led_pasek_spodni",
          partType: "HARDWARE",
          hardwareId: led.id,
          supplierId: led.supplierId,
          qty: parseFloat((rampaSpodniW / 1000).toFixed(3)),
          unit: "BM",
          unitPrice: ledPrice?.price ?? null,
          totalPrice: ledPrice
            ? parseFloat(((rampaSpodniW / 1000) * ledPrice.price).toFixed(2))
            : null,
          notes: `typ: ${bottomRailLedType}, barva: ${bottomRailLedColor ?? "—"}, ovladani: ${bottomRailLedControl ?? "—"}`,
          hardware: { id: led.id, name: led.name, type: led.type, supplierCode: led.supplierCode },
        });
      } else {
        warnings.push("Chybi LED pasek v DB");
      }
    }
  }

  const totalPrice = [...parts, ...hardware].reduce((sum, item) => sum + (item.totalPrice ?? 0), 0);

  return {
    parts,
    hardware,
    warnings,
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    meta: {
      doorCount,
      hingeCount,
      autoHingeCount: autoHingePerDoor * doorCount,
      visibleSideCount,
      backType,
      doorType,
      shelfCount: shelves,
    },
  };
}

async function findLedStrip() {
  return prisma.hardware.findFirst({
    where: {
      type: "OTHER",
      name: { contains: "led", mode: "insensitive" },
      inStock: true,
      active: true,
    },
    orderBy: { supplier: { priority: "asc" } },
  });
}
