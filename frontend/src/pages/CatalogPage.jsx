import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CatalogPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/templates")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Nepodarilo se nacist sablony");
        setTemplates(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Katalog skrinek</h1>
          <p className="mt-1 text-stone-600">Vyber sablonu a spocitej live BOM.</p>
        </div>
        <span className="text-sm text-stone-500">{templates.length} sablon</span>
      </div>

      {loading && <p className="text-stone-500">Nacitam…</p>}
      {error && <p className="text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/configurator/${t.id}`)}
            className="border border-[#d6d0c4] bg-[#faf8f3] p-6 text-left transition hover:border-[#8b5a2b]"
          >
            <p className="text-lg font-semibold text-stone-900">{t.name}</p>
            <p className="mt-2 text-sm text-stone-500">
              v{t.version} · {t.rules?.parts?.length ?? 0} dilu ·{" "}
              {t.rules?.hardware_rules?.length ?? 0} pravidel kovani
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
