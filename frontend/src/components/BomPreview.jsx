import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PART_TYPE_LABEL = { BOARD: "Dil", EDGE: "Hrana", FRONT: "Front", HARDWARE: "Kovani" };

function formatMoney(value) {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kc`;
}

export default function BomPreview({
  bom,
  advice,
  loading,
  error,
  dimensions,
  templateName,
  templateId,
  orderExtras = {},
  onOrder,
}) {
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderError, setOrderError] = useState(null);

  async function handleCreateOrder() {
    if (!bom) return;
    setOrdering(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          widthMm: dimensions.widthMm,
          heightMm: dimensions.heightMm,
          depthMm: dimensions.depthMm,
          backType: dimensions.backType,
          bom,
          ...orderExtras,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba pri vytvareni");
      setOrderId(data.id);
      onOrder?.(data);
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[#d6d0c4] bg-[#faf8f3] p-8">
        <p className="text-sm text-stone-500">Pocitam kusovnik…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
    );
  }

  if (!bom) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-[#d6d0c4] bg-[#faf8f3] p-8 text-stone-400">
        <p className="text-sm">Vyplnte rozmery a vyberte materialy</p>
      </div>
    );
  }

  const { widthMm: W, heightMm: H, depthMm: D } = dimensions;

  return (
    <div className="space-y-4">
      <div className="border border-[#d6d0c4] bg-[#faf8f3] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-stone-900">{templateName}</p>
            <p className="mt-0.5 text-sm text-stone-500">
              {W} × {H} × {D} mm
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-500">Celkova cena</p>
            <p className="text-2xl font-semibold text-[#8b5a2b]">{formatMoney(bom.totalPrice)}</p>
          </div>
        </div>
      </div>

      {advice?.tips?.length > 0 && (
        <div className="space-y-1 border border-amber-200 bg-amber-50 p-4">
          {advice.tips.map((tip, i) => (
            <p key={i} className="text-sm text-amber-900">
              {tip.message}
            </p>
          ))}
        </div>
      )}

      {bom.warnings?.length > 0 && (
        <div className="space-y-1 border border-yellow-200 bg-yellow-50 p-4">
          {bom.warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-900">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="overflow-hidden border border-[#d6d0c4] bg-[#faf8f3]">
        <table className="w-full text-sm">
          <thead className="bg-[#f0ebe2] text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 text-left">Dil</th>
              <th className="px-4 py-3 text-left">Typ</th>
              <th className="px-4 py-3 text-right">S × V</th>
              <th className="px-4 py-3 text-right">Tl.</th>
              <th className="px-4 py-3 text-right">Ks</th>
              <th className="px-4 py-3 text-right">Cena</th>
            </tr>
          </thead>
          <tbody>
            {(bom.parts ?? []).map((part, i) => (
              <tr key={i} className="border-t border-[#e8e2d6]">
                <td className="px-4 py-2.5 font-medium capitalize">
                  {part.partName}
                  {part.notes ? (
                    <span className="mt-0.5 block text-xs font-normal text-stone-400">{part.notes}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs text-stone-500">
                  {PART_TYPE_LABEL[part.partType] ?? part.partType}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {part.widthMm} × {part.heightMm}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-stone-500">
                  {part.thickness ? `${part.thickness} mm` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">{part.qty}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatMoney(part.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bom.hardware?.length > 0 && (
        <div className="overflow-hidden border border-[#d6d0c4] bg-[#faf8f3]">
          <div className="bg-[#f0ebe2] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Kovani
          </div>
          <table className="w-full text-sm">
            <tbody>
              {bom.hardware.map((hw, i) => (
                <tr key={i} className="border-t border-[#e8e2d6]">
                  <td className="px-4 py-2.5 font-medium capitalize">{hw.partName}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{hw.hardware?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {hw.qty} {hw.unit === "BM" ? "bm" : "ks"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatMoney(hw.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bom.meta && (
        <div className="border border-[#d6d0c4] bg-[#faf8f3] px-4 py-3 text-xs text-stone-500">
          {bom.meta.doorCount != null && <span>{bom.meta.doorCount} kridlo · </span>}
          {bom.meta.hingeCount != null && <span>{bom.meta.hingeCount} panty · </span>}
          {bom.meta.visibleSideCount != null && (
            <span>{bom.meta.visibleSideCount} pohled. bok · </span>
          )}
          {bom.meta.backType && <span>{bom.meta.backType}</span>}
        </div>
      )}

      <div className="border border-[#d6d0c4] bg-[#faf8f3] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500">
            {bom.parts?.length ?? 0} dilu · {bom.hardware?.length ?? 0} druhu kovani
          </span>
          <span className="text-lg font-semibold">{formatMoney(bom.totalPrice)}</span>
        </div>

        {orderError && <p className="mt-3 text-sm text-red-600">{orderError}</p>}

        {!orderId && (
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={ordering}
            className="mt-3 w-full bg-[#8b5a2b] py-2.5 text-sm font-medium text-[#f7f4ee] transition hover:bg-[#734820] disabled:opacity-40"
          >
            {ordering ? "Ukladam…" : "Vytvorit objednavku"}
          </button>
        )}

        {orderId && (
          <div className="mt-3 flex gap-2">
            <div className="flex-1 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Objednavka #{orderId} vytvorena
            </div>
            <button
              type="button"
              onClick={() => navigate(`/orders/${orderId}`)}
              className="border border-[#d6d0c4] px-4 py-2 text-sm text-stone-700 hover:bg-white"
            >
              Detail →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
