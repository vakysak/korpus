import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const STATUS_META = {
  DRAFT: { label: "Rozpracovana", color: "bg-stone-100 text-stone-600", next: "CONFIRMED" },
  CONFIRMED: { label: "Potvrzena", color: "bg-sky-100 text-sky-800", next: "ORDERED" },
  ORDERED: { label: "Odeslana", color: "bg-amber-100 text-amber-800", next: "IN_PRODUCTION" },
  IN_PRODUCTION: { label: "Ve vyrobe", color: "bg-violet-100 text-violet-800", next: "DONE" },
  DONE: { label: "Hotova", color: "bg-emerald-100 text-emerald-800", next: null },
  CANCELLED: { label: "Zrusena", color: "bg-red-100 text-red-600", next: null },
};

const NEXT_LABEL = {
  CONFIRMED: "Potvrdit",
  ORDERED: "Odeslat dodavateli",
  IN_PRODUCTION: "Zahajit vyrobu",
  DONE: "Dokoncit",
};

function formatMoney(value) {
  return `${Number(value).toLocaleString("cs-CZ", { minimumFractionDigits: 2 })} Kc`;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setOrder(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function patchStatus(status) {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrder((prev) => ({ ...prev, status: data.status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  function advanceStatus() {
    const next = STATUS_META[order.status]?.next;
    if (next) return patchStatus(next);
  }

  function cancelOrder() {
    if (!window.confirm("Opravdu zrusit objednavku?")) return;
    return patchStatus("CANCELLED");
  }

  function handleExport() {
    window.open(`/api/orders/${id}/export`, "_blank");
  }

  if (loading) return <p className="p-6 text-sm text-stone-400">Nacitam…</p>;
  if (!order) return <p className="p-6 text-sm text-red-600">{error ?? "Nenalezeno"}</p>;

  const meta = STATUS_META[order.status] ?? STATUS_META.DRAFT;
  const canCancel = ["DRAFT", "CONFIRMED"].includes(order.status);

  const bySupplier = order.items.reduce((acc, item) => {
    const key = item.supplier?.name ?? "Bez dodavatele";
    if (!acc[key]) acc[key] = { items: [], total: 0 };
    acc[key].items.push(item);
    acc[key].total += Number(item.totalPrice);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2 text-sm text-stone-400">
        <button type="button" onClick={() => navigate("/orders")} className="hover:text-[#8b5a2b]">
          Objednavky
        </button>
        <span>/</span>
        <span className="font-medium text-stone-700">#{order.id}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border border-[#d6d0c4] bg-[#faf8f3] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-stone-900">
                {order.template?.name ?? "Skrinka"} #{order.id}
              </h1>
              <span className={`px-2 py-0.5 text-xs font-medium ${meta.color}`}>{meta.label}</span>
            </div>
            <p className="font-mono text-sm text-stone-500">
              {order.widthMm} × {order.heightMm} × {order.depthMm} mm · {order.backType}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Vytvoreno {new Date(order.createdAt).toLocaleString("cs-CZ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-stone-500">Celkova cena</p>
            <p className="text-2xl font-semibold text-[#8b5a2b]">{formatMoney(order.totalPrice)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {meta.next && (
            <button
              type="button"
              onClick={advanceStatus}
              disabled={working}
              className="bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] hover:bg-[#734820] disabled:opacity-40"
            >
              {working ? "…" : NEXT_LABEL[meta.next]}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="border border-[#d6d0c4] px-4 py-2 text-sm text-stone-700 hover:bg-white"
          >
            Export CSV
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={cancelOrder}
              disabled={working}
              className="border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Zrusit
            </button>
          )}
        </div>
      </div>

      <div className="border border-[#d6d0c4] bg-[#faf8f3] p-5">
        <h2 className="mb-4 font-semibold text-stone-900">Nakupni seznam</h2>
        <div className="space-y-5">
          {Object.entries(bySupplier).map(([supplierName, group]) => (
            <div key={supplierName}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-stone-700">{supplierName}</p>
                <p className="text-sm font-medium">{formatMoney(group.total)}</p>
              </div>
              <table className="w-full text-xs">
                <thead className="border-b border-[#e8e2d6] text-stone-400">
                  <tr>
                    <th className="pb-1 text-left">Dil</th>
                    <th className="pb-1 text-left">Material</th>
                    <th className="pb-1 text-right">S × V</th>
                    <th className="pb-1 text-right">Mn.</th>
                    <th className="pb-1 text-right">Jedn.</th>
                    <th className="pb-1 text-right">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#eee9df] last:border-0">
                      <td className="py-1.5 capitalize">{item.partName}</td>
                      <td className="py-1.5 text-stone-500">
                        {item.material?.name ?? item.hardware?.name ?? "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {item.widthMm && item.heightMm
                          ? `${item.widthMm}×${item.heightMm}`
                          : "—"}
                      </td>
                      <td className="py-1.5 text-right">
                        {Number(item.qty).toFixed(item.unit === "M2" ? 4 : 0)}
                      </td>
                      <td className="py-1.5 text-right text-stone-400">{item.unit}</td>
                      <td className="py-1.5 text-right font-medium">{formatMoney(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
