import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_META = {
  DRAFT: { label: "Rozpracovana", color: "bg-stone-100 text-stone-600" },
  CONFIRMED: { label: "Potvrzena", color: "bg-sky-100 text-sky-800" },
  ORDERED: { label: "Odeslana", color: "bg-amber-100 text-amber-800" },
  IN_PRODUCTION: { label: "Ve vyrobe", color: "bg-violet-100 text-violet-800" },
  DONE: { label: "Hotova", color: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Zrusena", color: "bg-red-100 text-red-600" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const url = filter ? `/api/orders?status=${filter}` : "/api/orders";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Objednavky</h1>
          <p className="mt-0.5 text-sm text-stone-500">{total} celkem</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/catalog")}
          className="bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] hover:bg-[#734820]"
        >
          + Nova skrinka
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: "", label: "Vse" }, ...Object.entries(STATUS_META).map(([value, { label }]) => ({
          value,
          label,
        }))].map((opt) => (
          <button
            key={opt.value || "all"}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              filter === opt.value
                ? "bg-[#8b5a2b] text-[#f7f4ee]"
                : "border border-[#d6d0c4] text-stone-600 hover:bg-[#faf8f3]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-20 text-center text-sm text-stone-400">Nacitam…</p>
      ) : orders.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-hidden border border-[#d6d0c4] bg-[#faf8f3]">
          <table className="w-full text-sm">
            <thead className="bg-[#f0ebe2] text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Sablona</th>
                <th className="px-4 py-3 text-left">Rozmery</th>
                <th className="px-4 py-3 text-right">Cena</th>
                <th className="px-4 py-3 text-left">Stav</th>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const meta = STATUS_META[order.status] ?? STATUS_META.DRAFT;
                return (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-t border-[#e8e2d6] hover:bg-white/60"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-stone-400">#{order.id}</td>
                    <td className="px-4 py-3 font-medium">{order.template?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">
                      {order.widthMm} × {order.heightMm} × {order.depthMm}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(order.totalPrice).toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      Kc
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">
                      {new Date(order.createdAt).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-300">→</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty() {
  const navigate = useNavigate();
  return (
    <div className="py-20 text-center text-stone-400">
      <p className="mb-4 text-sm">Zadne objednavky</p>
      <button
        type="button"
        onClick={() => navigate("/catalog")}
        className="bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] hover:bg-[#734820]"
      >
        Vytvorit prvni skrinku
      </button>
    </div>
  );
}
