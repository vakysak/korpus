import { getPriceRange } from "./context.js";

const handlers = {
  async bom_preview({ bom }) {
    const tips = [];

    for (const part of bom.parts ?? []) {
      if (!part.unitPrice || !part.material?.category) continue;
      const range = await getPriceRange(part.material.category);
      if (!range) continue;
      if (part.unitPrice > range.avg * 2) {
        tips.push({
          type: "price_anomaly",
          part: part.partName,
          message: `Cena ${part.unitPrice} Kc/m2 je vyrazne nad prumerem (${range.avg} Kc/m2)`,
        });
      }
    }

    for (const w of bom.warnings ?? []) {
      tips.push({ type: "warning", message: w });
    }

    return tips.length ? { tips } : null;
  },

  async catalog_open() {
    return null;
  },
  async order_confirm() {
    return null;
  },
  async import_done() {
    return null;
  },
};

/**
 * Silent lymph entrypoint – never throws, never blocks the UX.
 */
export async function advise(event, payload) {
  try {
    const handler = handlers[event];
    if (!handler) return null;
    return await handler(payload);
  } catch {
    return null;
  }
}
