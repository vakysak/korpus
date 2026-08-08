/**
 * BOM engine – bezpečný evaluátor výrazů (bez eval).
 * Material: Prisma pole `thickness` (Decimal), ne thicknessMm / role.
 */

/**
 * @typedef {object} MaterialLike
 * @property {number|string|import('@prisma/client').Prisma.Decimal} thickness
 * @property {number} [id]
 * @property {string} [name]
 * @property {string|null} [code]
 */

/**
 * @typedef {object} BomInput
 * @property {number} widthMm
 * @property {number} heightMm
 * @property {number} depthMm
 * @property {"overlaid_hdf"|"half_dado_hdf"|"rectification"|"overlaid_solid"|"dado_solid"} backType
 * @property {{ corpus: MaterialLike, back: MaterialLike, front: MaterialLike }} materialMap
 */

/**
 * @typedef {object} BomPart
 * @property {string} name
 * @property {number} widthMm
 * @property {number} heightMm
 * @property {number} thicknessMm
 * @property {MaterialLike|null} material
 * @property {number} quantity
 */

/**
 * @typedef {object} BomHardware
 * @property {string} type
 * @property {number} count
 */

/**
 * @typedef {object} BomResult
 * @property {BomPart[]} parts
 * @property {BomHardware[]} hardware
 * @property {string[]} warnings
 */

/**
 * @param {MaterialLike|null|undefined} material
 * @param {number} fallback
 */
export function thicknessMm(material, fallback = 18) {
  if (!material || material.thickness == null) return fallback;
  return Number(material.thickness);
}

/** @param {string} expr @param {Record<string, number>} vars */
function evaluate(expr, vars) {
  const tokens = tokenize(expr.trim());
  const result = parseExpr(tokens, 0, vars);
  return result.value;
}

/**
 * @typedef {{ type: "num", val: number }
 *   | { type: "op", val: string }
 *   | { type: "var", val: string }
 *   | { type: "lparen" }
 *   | { type: "rparen" }} Token
 */

/** @param {string} expr @returns {Token[]} */
function tokenize(expr) {
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: "num", val: parseFloat(num) });
    } else if (/[a-zA-Z_]/.test(ch)) {
      let name = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) name += expr[i++];
      tokens.push({ type: "var", val: name });
    } else if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", val: ch });
      i++;
    } else if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
    } else {
      i++;
    }
  }
  return tokens;
}

/** @param {Token[]} tokens @param {number} pos @param {Record<string, number>} vars */
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

/** @param {Token[]} tokens @param {number} pos @param {Record<string, number>} vars */
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

/** @param {Token[]} tokens @param {number} pos @param {Record<string, number>} vars */
function parseFactor(tokens, pos, vars) {
  const t = tokens[pos];
  if (!t) throw new Error(`Neočekávaný konec výrazu na pozici ${pos}`);
  if (t.type === "num") return { value: t.val, pos: pos + 1 };
  if (t.type === "var") {
    const val = vars[t.val];
    if (val === undefined) throw new Error(`Neznámá proměnná: ${t.val}`);
    return { value: val, pos: pos + 1 };
  }
  if (t.type === "lparen") {
    const { value, pos: p } = parseExpr(tokens, pos + 1, vars);
    if (tokens[p]?.type !== "rparen") throw new Error("Chybí zavírací závorka");
    return { value, pos: p + 1 };
  }
  throw new Error(`Neočekávaný token: ${JSON.stringify(t)}`);
}

/** @param {string} condition @param {Record<string, number>} vars */
function evaluateCondition(condition, vars) {
  const match = condition.match(/^(.+?)(<=|>=|<|>|==)(.+)$/);
  if (!match) throw new Error(`Nepodporovaná podmínka: ${condition}`);
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

/**
 * @param {{ rules: unknown, name?: string }} template
 * @param {BomInput} input
 * @returns {BomResult}
 */
export function computeBom(template, input) {
  const rules = /** @type {{
    parts: Array<{ name: string, width: string, height: string, material: "corpus"|"back"|"front" }>,
    defaults: Record<string, number>,
    hardware_rules: Array<{ type: string, count: number, condition: string }>
  }} */ (template.rules);

  /** @type {string[]} */
  const warnings = [];
  const defaults = rules.defaults ?? {};

  const T = thicknessMm(input.materialMap.corpus, defaults.thickness_corpus ?? 18);
  const TB = thicknessMm(input.materialMap.back, 3);

  const back_offset =
    input.backType === "half_dado_hdf"
      ? (defaults.back_offset_half_dado_hdf ?? 9)
      : (defaults.back_offset_overlaid_hdf ?? 0);

  /** @type {Record<string, number>} */
  const vars = {
    W: input.widthMm,
    H: input.heightMm,
    D: input.depthMm,
    T,
    TB,
    back_offset,
    door_height: input.heightMm,
  };

  const parts = (rules.parts ?? []).map((part) => {
    let w = 0;
    let h = 0;
    try {
      w = Math.round(evaluate(part.width, vars));
      h = Math.round(evaluate(part.height, vars));
    } catch (err) {
      warnings.push(`Díl "${part.name}": chyba výpočtu – ${err.message}`);
    }

    const material = input.materialMap[part.material] ?? null;
    if (!material) {
      warnings.push(`Díl "${part.name}": neznámá role materiálu "${part.material}"`);
    }

    return {
      name: part.name,
      widthMm: w,
      heightMm: h,
      thicknessMm: thicknessMm(material, part.material === "back" ? TB : T),
      material: material
        ? {
            id: material.id,
            name: material.name,
            code: material.code ?? null,
            thickness: thicknessMm(material, T),
          }
        : null,
      quantity: 1,
    };
  });

  /** @type {BomHardware[]} */
  const hardware = [];
  const matchedTypes = new Set();

  for (const rule of rules.hardware_rules ?? []) {
    try {
      if (!evaluateCondition(rule.condition, vars)) continue;
      // první vyhovující pravidlo per type (hinge 2 vs 3)
      if (matchedTypes.has(rule.type)) continue;
      matchedTypes.add(rule.type);
      hardware.push({ type: rule.type, count: rule.count });
    } catch (err) {
      warnings.push(`Hardware rule "${rule.condition}": ${err.message}`);
    }
  }

  return { parts, hardware, warnings };
}

export { evaluate as _evaluate, evaluateCondition as _evaluateCondition };
