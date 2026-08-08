import { prisma } from "../db.js";

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(expr[i])) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: "num", val: parseFloat(num) });
    } else if (/[a-zA-Z_]/.test(expr[i])) {
      let name = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) name += expr[i++];
      tokens.push({ type: "var", val: name });
    } else if ("+-*/".includes(expr[i])) {
      tokens.push({ type: "op", val: expr[i++] });
    } else if (expr[i] === "(") {
      tokens.push({ type: "lparen" });
      i++;
    } else if (expr[i] === ")") {
      tokens.push({ type: "rparen" });
      i++;
    } else {
      i++;
    }
  }
  return tokens;
}

function parseExpr(tokens, pos, vars) {
  let { value: left, pos: p } = parseTerm(tokens, pos, vars);
  while (
    p < tokens.length &&
    tokens[p].type === "op" &&
    (tokens[p].val === "+" || tokens[p].val === "-")
  ) {
    const op = tokens[p].val;
    const { value: right, pos: np } = parseTerm(tokens, p + 1, vars);
    left = op === "+" ? left + right : left - right;
    p = np;
  }
  return { value: left, pos: p };
}

function parseTerm(tokens, pos, vars) {
  let { value: left, pos: p } = parseFactor(tokens, pos, vars);
  while (
    p < tokens.length &&
    tokens[p].type === "op" &&
    (tokens[p].val === "*" || tokens[p].val === "/")
  ) {
    const op = tokens[p].val;
    const { value: right, pos: np } = parseFactor(tokens, p + 1, vars);
    left = op === "*" ? left * right : left / right;
    p = np;
  }
  return { value: left, pos: p };
}

function parseFactor(tokens, pos, vars) {
  const t = tokens[pos];
  if (!t) throw new Error(`Neocekavany konec vyrazu na pozici ${pos}`);
  if (t.type === "num") return { value: t.val, pos: pos + 1 };
  if (t.type === "var") {
    const val = vars[t.val];
    if (val === undefined) throw new Error(`Neznama promenna: ${t.val}`);
    return { value: val, pos: pos + 1 };
  }
  if (t.type === "lparen") {
    const { value, pos: p } = parseExpr(tokens, pos + 1, vars);
    if (tokens[p]?.type !== "rparen") throw new Error("Chybi zaviraci zavorka");
    return { value, pos: p + 1 };
  }
  throw new Error(`Neocekavany token: ${JSON.stringify(t)}`);
}

export function evaluate(expr, vars) {
  return parseExpr(tokenize(expr.trim()), 0, vars).value;
}

export function evaluateCondition(condition, vars) {
  const match = condition.match(/^(.+?)(<=|>=|<|>|==)(.+)$/);
  if (!match) throw new Error(`Nepodporovana podminka: ${condition}`);
  const left = evaluate(match[1].trim(), vars);
  const right = evaluate(match[3].trim(), vars);
  switch (match[2]) {
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "==":
      return left === right;
    default:
      return false;
  }
}

async function getMaterialPrice(materialId) {
  return prisma.priceListItem.findFirst({
    where: {
      materialId,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    include: { supplier: true },
    orderBy: [{ supplier: { priority: "asc" } }, { validFrom: "desc" }],
  });
}

async function getHardwarePrice(hardwareId) {
  return prisma.priceListItem.findFirst({
    where: {
      hardwareId,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    include: { supplier: true },
    orderBy: [{ supplier: { priority: "asc" } }, { validFrom: "desc" }],
  });
}

function calcPartPrice(widthMm, heightMm, priceItem) {
  if (!priceItem) return null;
  const price = parseFloat(priceItem.price);
  if (priceItem.unit === "M2") {
    return parseFloat(((widthMm / 1000) * (heightMm / 1000) * price).toFixed(4));
  }
  if (priceItem.unit === "BM") {
    // obvod approx: 2*(w+h) for edge banding later; for now length = width
    return parseFloat(((widthMm / 1000) * price).toFixed(4));
  }
  return price;
}

function serializeMaterial(m) {
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    supplierCode: m.supplierCode,
    category: m.category,
    thickness: Number(m.thickness),
  };
}

/**
 * @param {{ rules: any, name?: string }} template
 * @param {{
 *   widthMm: number,
 *   heightMm: number,
 *   depthMm: number,
 *   backType: string,
 *   materialMap: { corpus: any, back: any, front: any }
 * }} input
 */
export async function computeBom(template, input) {
  const rules = template.rules;
  const warnings = [];

  const T = Number(input.materialMap.corpus?.thickness) || rules.defaults?.thickness_corpus || 18;
  const TB = Number(input.materialMap.back?.thickness) || 3;

  const backType = String(input.backType || "OVERLAID_HDF").toUpperCase();
  const back_offset =
    backType === "HALF_DADO_HDF"
      ? (rules.defaults?.back_offset_half_dado_hdf ?? 9)
      : (rules.defaults?.back_offset_overlaid_hdf ?? 0);

  const vars = {
    W: input.widthMm,
    H: input.heightMm,
    D: input.depthMm,
    T,
    TB,
    back_offset,
    door_height: input.heightMm,
  };

  const parts = [];
  for (const part of rules.parts ?? []) {
    let w = 0;
    let h = 0;
    try {
      w = Math.round(evaluate(part.width, vars));
      h = Math.round(evaluate(part.height, vars));
    } catch (err) {
      warnings.push(`Dil "${part.name}": ${err.message}`);
    }

    const material = input.materialMap[part.material];
    if (!material) {
      warnings.push(`Dil "${part.name}": neznama role "${part.material}"`);
    }

    let unitPrice = null;
    let totalPrice = null;
    let unit = "M2";
    let qty = 1;
    if (material) {
      const priceItem = await getMaterialPrice(material.id);
      unitPrice = priceItem ? parseFloat(priceItem.price) : null;
      totalPrice = priceItem ? calcPartPrice(w, h, priceItem) : null;
      unit = priceItem?.unit ?? "M2";
      if (unit === "M2") {
        qty = parseFloat(((w / 1000) * (h / 1000)).toFixed(4));
      } else if (unit === "BM") {
        qty = parseFloat((w / 1000).toFixed(4));
      }
      if (!priceItem) warnings.push(`Dil "${part.name}": chybi cena materialu id=${material.id}`);
    }

    parts.push({
      partName: part.name,
      partType: "BOARD",
      widthMm: w,
      heightMm: h,
      thickness: material ? Number(material.thickness) : T,
      materialId: material?.id ?? null,
      supplierId: material?.supplierId ?? null,
      material: serializeMaterial(material),
      qty,
      unit,
      unitPrice,
      totalPrice,
    });
  }

  const hardware = [];
  const matchedTypes = new Set();

  for (const rule of rules.hardware_rules ?? []) {
    try {
      if (!evaluateCondition(rule.condition, vars)) continue;
      const typeKey = String(rule.type).toUpperCase();
      if (matchedTypes.has(typeKey)) continue;
      matchedTypes.add(typeKey);

      const hw = await prisma.hardware.findFirst({
        where: { type: typeKey, inStock: true, active: true },
        include: { supplier: true },
        orderBy: { supplier: { priority: "asc" } },
      });

      let unitPrice = null;
      let totalPrice = null;
      if (hw) {
        const priceItem = await getHardwarePrice(hw.id);
        unitPrice = priceItem ? parseFloat(priceItem.price) : null;
        totalPrice = unitPrice !== null ? parseFloat((unitPrice * rule.count).toFixed(4)) : null;
        if (!priceItem) warnings.push(`Kovani "${rule.type}": chybi cena`);
      } else {
        warnings.push(`Kovani "${rule.type}": nenalezeno v DB`);
      }

      hardware.push({
        partName: rule.type,
        partType: "HARDWARE",
        hardwareId: hw?.id ?? null,
        supplierId: hw?.supplierId ?? null,
        hardware: hw
          ? {
              id: hw.id,
              name: hw.name,
              supplierCode: hw.supplierCode,
              type: hw.type,
              supplier: hw.supplier?.code,
            }
          : null,
        qty: rule.count,
        unit: "PC",
        unitPrice,
        totalPrice,
      });
    } catch (err) {
      warnings.push(`Hardware rule "${rule.condition}": ${err.message}`);
    }
  }

  const totalPriceSum = [...parts, ...hardware].reduce(
    (sum, item) => sum + (item.totalPrice ?? 0),
    0,
  );

  return {
    parts,
    hardware,
    totalPrice: parseFloat(totalPriceSum.toFixed(4)),
    warnings,
  };
}
