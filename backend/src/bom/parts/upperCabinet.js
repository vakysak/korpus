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
  // Bok: s = D, v = H (beze zmeny)
  const bokW = D;
  const bokH = H;
  parts.push(
    makePart("bok", "BOARD", bokW, bokH, Tc, materialCorpus, corpusPrice, 2, {
      front: true,
      bottom: true,
    }, "predni + dolni hrana"),
  );

  // Dno / Puda: s = W - 2*Tc, v = D
  // Retifikace: puda v = D - 20 (2 cm), police v = D - 40 (4 cm)
  const isRectification = String(backType).toUpperCase() === "RECTIFICATION";
  const dnoW = W - 2 * Tc;
  const dnoH = D;
  const pudaH = isRectification ? D - 20 : D;
  parts.push(
    makePart("dno", "BOARD", dnoW, dnoH, Tc, materialCorpus, corpusPrice, 1, { front: true }, "predni hrana"),
  );
  parts.push(
    makePart(
      "puda",
      "BOARD",
      dnoW,
      pudaH,
      Tc,
      materialCorpus,
      corpusPrice,
      1,
      { front: true },
      isRectification ? "predni hrana · retifikace D-20" : "predni hrana",
    ),
  );

  // Police: s = W - 2*Tc, v = D - 20 (retifikace: D - 40)
  const shelves = Number(shelfCount) || 0;
  if (shelves > 0) {
    const policeH = isRectification ? D - 40 : D - 20;
    parts.push(
      makePart(
        "police",
        "BOARD",
        W - 2 * Tc,
        policeH,
        Tc,
        materialCorpus,
        corpusPrice,
        shelves,
        { front: true },
        isRectification ? "predni hrana · retifikace D-40" : "predni hrana",
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

  // ── Dvirka / otevirani ────────────────────────────────────────────────────
  // HANDLE / HANDLE_BAR – plny material, pant nalozny s dotahem
  // TIP_ON               – plny material, pant nalozny bez dotahu + tip-on
  // GLASS_ALU            – prosklena, hlinikovy ramecek (+ pant s dotahem)
  // FLAP                 – vyklopna, plny material + Blum vyklop + tip-on
  const dtype = String(doorType || "HANDLE").toUpperCase();
  const isFlap = dtype === "FLAP";
  const isGlass = dtype === "GLASS_ALU";
  const isTipOn = dtype === "TIP_ON";
  const isSoftcloseSwing = dtype === "HANDLE" || dtype === "HANDLE_BAR" || isGlass;

  const doorCount = isFlap ? 1 : W < 650 ? 1 : 2;
  const doorW = doorCount === 1 ? W - 0.6 : W / 2 - 0.6;
  const barH = Number(handleBarHeight) || 0;
  const doorH = dtype === "HANDLE_BAR" ? H - 0.6 - barH : H - 0.6;

  if (isGlass) {
    // Sklo v alu ramecku – panel skla (FRONT material jako stub) + ramecek
    parts.push(
      makePart(
        "sklo_dvere",
        "FRONT",
        doorW,
        doorH,
        Tf,
        materialFront,
        frontPrice,
        doorCount,
        {},
        "prosklena vydro / stub materialu frontu",
      ),
    );
    const aluFrame = await findHardwareByName(["ramecek", "alu", "hlinik"]);
    const aluPrice = await getHardwarePrice(aluFrame?.id);
    if (!aluFrame) warnings.push("Chybi hlinikovy ramecek v DB");
    hardware.push(makeHardware("hlinikovy_ramecek", aluFrame, doorCount, aluPrice, "prosklena dvirka"));
  } else {
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
        isFlap ? "vyklopna – hrana kolem dokola" : "hrana kolem dokola",
      ),
    );
  }

  if (dtype === "HANDLE_BAR" && barH > 0) {
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

  // Panty / vyklopy
  const autoHingePerDoor = doorH < 1200 ? 2 : 3;
  let hingeCount = 0;
  let autoHingeCount = 0;

  if (isFlap) {
    const flap = await findHardwareByName(["aventos", "vyklop", "flap", "hk-"]);
    const flapPrice = await getHardwarePrice(flap?.id);
    if (!flap) warnings.push("Chybi Blum vyklop (Aventos) v DB");
    hardware.push(makeHardware("vyklop_blum", flap, 1, flapPrice, "vyklopna dvirka"));
  } else if (isSoftcloseSwing || isTipOn) {
    const softclose = isSoftcloseSwing;
    const hinge = softclose
      ? await findHinge({ softclose: true })
      : await findHinge({ softclose: false });
    const hingePerDoor = hingeOverride != null ? Number(hingeOverride) : autoHingePerDoor;
    hingeCount = hingePerDoor * doorCount;
    autoHingeCount = autoHingePerDoor * doorCount;
    const hingePrice = await getHardwarePrice(hinge?.id);
    if (!hinge) {
      warnings.push(
        softclose
          ? "Chybi pant nalozny s dotahem v DB"
          : "Chybi pant nalozny bez dotahu v DB",
      );
    }
    hardware.push({
      ...makeHardware(
        softclose ? "pant_s_dotahem" : "pant_bez_dotahu",
        hinge,
        hingeCount,
        hingePrice,
        softclose ? "nalozny s dotahem" : "nalozny bez dotahu",
      ),
      autoCount: autoHingeCount,
      perDoor: hingePerDoor,
      doorCount,
    });
  }

  if (dtype === "HANDLE" && handleId) {
    const handle = await prisma.hardware.findUnique({ where: { id: Number(handleId) } });
    const handlePrice = await getHardwarePrice(handle?.id);
    if (!handle) warnings.push("Chybi vybrana uchytka");
    else hardware.push(makeHardware("uchytka", handle, doorCount, handlePrice));
  }

  if (isTipOn || isFlap) {
    const tipOnHw = await findHardwareByName(["tip-on", "tip on", "tipon"]);
    const tipOnPrice = await getHardwarePrice(tipOnHw?.id);
    if (!tipOnHw) warnings.push("Chybi tip-on v DB");
    hardware.push(makeHardware("tip_on", tipOnHw, doorCount, tipOnPrice));
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
  // s = W + (pohledove boky × Tf), v/h dilu = h skrine + 21 (D + 21)
  if (bottomRailEnabled) {
    const rampaSpodniW = W + visibleSideCount * Tf;
    const rampaSpodniH = D + 21;
    parts.push(
      makePart(
        "rampa_spodni",
        "FRONT",
        rampaSpodniW,
        rampaSpodniH,
        Tf,
        materialFront,
        frontPrice,
        1,
        { top: true, left: true, right: true },
        bottomRailLed
          ? `spodni rampa – LED ${bottomRailLedType} / ${bottomRailLedColor ?? ""}`
          : "spodni rampa · D+21",
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
      autoHingeCount,
      visibleSideCount,
      backType,
      doorType: dtype,
      shelfCount: shelves,
      opening: isFlap
        ? "vyklopna"
        : isGlass
          ? "prosklena_alu"
          : isTipOn
            ? "tip_on_bez_dotahu"
            : "pant_s_dotahem",
    },
  };
}

async function findHardwareByName(needles) {
  const all = await prisma.hardware.findMany({
    where: { inStock: true, active: true },
    orderBy: { supplier: { priority: "asc" } },
  });
  const lowerNeedles = needles.map((n) => n.toLowerCase());
  return (
    all.find((h) => {
      const name = h.name.toLowerCase();
      return lowerNeedles.some((n) => name.includes(n));
    }) ?? null
  );
}

async function findHinge({ softclose }) {
  const hinges = await prisma.hardware.findMany({
    where: { type: "HINGE", inStock: true, active: true },
    orderBy: { supplier: { priority: "asc" } },
  });
  if (softclose) {
    return (
      hinges.find((h) => {
        const n = h.name.toLowerCase();
        return n.includes("dotah") || n.includes("soft") || n.includes("blumotion") || n.includes("clip top");
      }) ??
      hinges[0] ??
      null
    );
  }
  return (
    hinges.find((h) => {
      const n = h.name.toLowerCase();
      return n.includes("bez dotahu") || n.includes("bez-dotahu") || n.includes("spring");
    }) ??
    hinges.find((h) => {
      const n = h.name.toLowerCase();
      return !n.includes("dotah") && !n.includes("soft") && !n.includes("blumotion");
    }) ??
    null
  );
}

async function findLedStrip() {
  return findHardwareByName(["led pasek", "led strip", "led "]);
}
