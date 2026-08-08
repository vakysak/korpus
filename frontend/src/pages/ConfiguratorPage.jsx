import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BomPreview from "../components/BomPreview.jsx";

const BACK_TYPES = [
  { value: "OVERLAID_HDF", label: "Prelozena zada (HDF)" },
  { value: "HALF_DADO_HDF", label: "Zada v drazce (HDF)" },
];

const CATEGORY_LABELS = {
  BOARD: "Korpus",
  HDF: "Zada",
  FRONT: "Front / Dvirka",
};

export default function ConfiguratorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [materials, setMaterials] = useState({ BOARD: [], HDF: [], FRONT: [] });
  const [form, setForm] = useState({
    widthMm: 600,
    heightMm: 720,
    depthMm: 560,
    backType: "OVERLAID_HDF",
    materialId: "",
    materialBackId: "",
    materialFrontId: "",
  });
  const [bom, setBom] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageLoad, setPageLoad] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        const [tmpl, boards, hdfs, fronts] = await Promise.all([
          fetch(`/api/templates/${id}`).then((r) => r.json()),
          fetch("/api/materials?category=BOARD").then((r) => r.json()),
          fetch("/api/materials?category=HDF").then((r) => r.json()),
          fetch("/api/materials?category=FRONT").then((r) => r.json()),
        ]);
        if (tmpl.error) throw new Error(tmpl.error);

        const frontList = fronts.length ? fronts : boards;
        setTemplate(tmpl);
        setMaterials({ BOARD: boards, HDF: hdfs, FRONT: frontList });
        setForm((prev) => ({
          ...prev,
          materialId: boards[0]?.id ?? "",
          materialBackId: hdfs[0]?.id ?? "",
          materialFrontId: frontList[0]?.id ?? "",
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setPageLoad(false);
      }
    }
    init();
  }, [id]);

  const fetchBom = useCallback(
    async (values) => {
      if (!values.materialId || !values.materialBackId || !values.materialFrontId) return;
      if (!values.widthMm || !values.heightMm || !values.depthMm) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/bom/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: Number(id), ...values }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "BOM vypocet selhal");
        setBom(data.bom);
        setAdvice(data.advice);
      } catch (err) {
        setError(err.message);
        setBom(null);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (pageLoad) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBom(form), 400);
    return () => clearTimeout(debounceRef.current);
  }, [form, pageLoad, fetchBom]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function materialLabel(m) {
    const price = m.price != null ? ` · ${m.price} Kc/${m.unit}` : "";
    return `${m.name} (${m.supplier?.code ?? "?"}${price})`;
  }

  if (pageLoad) {
    return <div className="mx-auto max-w-6xl px-6 py-16 text-stone-500">Nacitam konfigurator…</div>;
  }

  if (!template) {
    return <p className="p-6 text-red-700">{error ?? "Sablona nenalezena"}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <button type="button" onClick={() => navigate("/catalog")} className="hover:text-[#8b5a2b]">
          Katalog
        </button>
        <span>/</span>
        <span className="font-medium text-stone-800">{template.name}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Section title="Rozmery (mm)">
            <div className="grid grid-cols-3 gap-3">
              {[
                { field: "widthMm", label: "Sirka", min: 150, max: 1200 },
                { field: "heightMm", label: "Vyska", min: 200, max: 2400 },
                { field: "depthMm", label: "Hloubka", min: 150, max: 800 },
              ].map(({ field, label, min, max }) => (
                <label key={field} className="block">
                  <span className="text-xs text-stone-500">{label}</span>
                  <input
                    type="number"
                    value={form[field]}
                    min={min}
                    max={max}
                    step={1}
                    onChange={(e) => set(field, Number(e.target.value) || 0)}
                    className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="Typ zad">
            <div className="flex flex-col gap-2">
              {BACK_TYPES.map((bt) => (
                <label
                  key={bt.value}
                  className={`flex cursor-pointer items-center gap-3 border px-3 py-2.5 transition ${
                    form.backType === bt.value
                      ? "border-[#8b5a2b] bg-[#f3ebe0]"
                      : "border-[#d6d0c4] hover:bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="backType"
                    value={bt.value}
                    checked={form.backType === bt.value}
                    onChange={() => set("backType", bt.value)}
                  />
                  <span className="text-sm">{bt.label}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Materialy">
            {[
              { field: "materialId", category: "BOARD", label: CATEGORY_LABELS.BOARD },
              { field: "materialBackId", category: "HDF", label: CATEGORY_LABELS.HDF },
              { field: "materialFrontId", category: "FRONT", label: CATEGORY_LABELS.FRONT },
            ].map(({ field, category, label }) => (
              <label key={field} className="mb-3 block">
                <span className="text-xs text-stone-500">{label}</span>
                <select
                  value={form[field]}
                  onChange={(e) => set(field, Number(e.target.value))}
                  className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                >
                  <option value="">— vyberte —</option>
                  {(materials[category] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {materialLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </Section>
        </div>

        <BomPreview
          bom={bom}
          advice={advice}
          loading={loading}
          error={error}
          dimensions={form}
          templateName={template.name}
          templateId={template.id}
        />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border border-[#d6d0c4] bg-[#faf8f3] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</p>
      {children}
    </div>
  );
}
