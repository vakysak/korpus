import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BomPreview from "../components/BomPreview.jsx";

const BACK_TYPES_BASIC = [
  { value: "OVERLAID_HDF", label: "Nalozena HDF" },
  { value: "HALF_DADO_HDF", label: "Do polodrazky HDF" },
];

const BACK_TYPES_UPPER = [
  { value: "OVERLAID_HDF", label: "Nalozena HDF" },
  { value: "HALF_DADO_HDF", label: "Do polodrazky HDF" },
  { value: "RECTIFICATION", label: "Retifikace HDF" },
  { value: "OVERLAID_SOLID", label: "Pevna nalozena" },
  { value: "DADO_SOLID", label: "Pevna do drazky" },
];

const CATEGORY_LABELS = {
  BOARD: "Korpus",
  HDF: "Zada",
  FRONT: "Front / Dvirka",
};

const DEFAULT_UPPER = {
  shelfCount: 1,
  visibleSideLeft: false,
  visibleSideRight: false,
  topRailEnabled: false,
  topRailOverhang: 21,
  topRailLed: false,
  topRailLedColor: "warm",
  topRailLedControl: "switch",
  bottomRailEnabled: false,
  bottomRailLed: false,
  bottomRailLedType: "CORNER_OVERLAY",
  bottomRailLedColor: "warm",
  bottomRailLedControl: "switch",
  doorType: "HANDLE",
  handleId: "",
  handleBarHeight: 0,
  hingeOverride: null,
};

export default function ConfiguratorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [materials, setMaterials] = useState({ BOARD: [], HDF: [], FRONT: [] });
  const [handles, setHandles] = useState([]);
  const [form, setForm] = useState({
    widthMm: 600,
    heightMm: 720,
    depthMm: 560,
    backType: "OVERLAID_HDF",
    materialId: "",
    materialBackId: "",
    materialFrontId: "",
  });
  const [upper, setUpperState] = useState(DEFAULT_UPPER);
  const [bom, setBom] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageLoad, setPageLoad] = useState(true);
  const debounceRef = useRef(null);

  const isUpper = template?.rules?.engine === "upperCabinet";

  useEffect(() => {
    async function init() {
      try {
        const [tmpl, boards, hdfs, fronts, hw] = await Promise.all([
          fetch(`/api/templates/${id}`).then((r) => r.json()),
          fetch("/api/materials?category=BOARD").then((r) => r.json()),
          fetch("/api/materials?category=HDF").then((r) => r.json()),
          fetch("/api/materials?category=FRONT").then((r) => r.json()),
          fetch("/api/hardware?type=HANDLE").then((r) => r.json()).catch(() => []),
        ]);
        if (tmpl.error) throw new Error(tmpl.error);

        const frontList = fronts.length ? fronts : boards;
        const defaults = tmpl.rules?.defaults ?? {};
        setTemplate(tmpl);
        setMaterials({ BOARD: boards, HDF: hdfs, FRONT: frontList });
        setHandles(Array.isArray(hw) ? hw : []);
        setForm((prev) => ({
          ...prev,
          depthMm: defaults.depthMm ?? prev.depthMm,
          backType: defaults.backType ?? prev.backType,
          materialId: boards[0]?.id ?? "",
          materialBackId: hdfs[0]?.id ?? "",
          materialFrontId: frontList[0]?.id ?? "",
        }));
        if (tmpl.rules?.engine === "upperCabinet") {
          setUpperState((prev) => ({
            ...prev,
            shelfCount: defaults.shelfCount ?? 1,
            doorType: defaults.doorType ?? "HANDLE",
            topRailOverhang: defaults.topRailOverhang ?? 21,
            handleId: Array.isArray(hw) && hw[0] ? hw[0].id : "",
          }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setPageLoad(false);
      }
    }
    init();
  }, [id]);

  const requestPayload = useCallback(() => {
    const payload = { templateId: Number(id), ...form };
    if (isUpper) {
      Object.assign(payload, {
        ...upper,
        handleId: upper.handleId || null,
        hingeOverride: upper.hingeOverride,
      });
    }
    return payload;
  }, [id, form, upper, isUpper]);

  const fetchBom = useCallback(async () => {
    if (!form.materialId || !form.materialBackId || !form.materialFrontId) return;
    if (!form.widthMm || !form.heightMm || !form.depthMm) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bom/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload()),
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
  }, [form, requestPayload]);

  useEffect(() => {
    if (pageLoad) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBom(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [form, upper, pageLoad, fetchBom]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setUpper(field, value) {
    setUpperState((prev) => ({ ...prev, [field]: value }));
  }

  function materialLabel(m) {
    const price = m.price != null ? ` · ${m.price} Kc/${m.unit}` : "";
    return `${m.name} (${m.supplier?.code ?? "?"}${price})`;
  }

  const backTypes = isUpper ? BACK_TYPES_UPPER : BACK_TYPES_BASIC;

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
            {isUpper && (
              <p className="mt-2 text-xs text-stone-400">
                Kridla: auto {form.widthMm < 650 ? "1" : "2"} (hranice 650 mm)
              </p>
            )}
          </Section>

          <Section title="Typ zad">
            <div className="flex flex-col gap-2">
              {backTypes.map((bt) => (
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

          {isUpper && (
            <>
              <Section title="Police">
                <label className="block">
                  <span className="text-xs text-stone-500">Pocet polic</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={upper.shelfCount}
                    onChange={(e) => setUpper("shelfCount", Number(e.target.value) || 0)}
                    className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                  />
                </label>
              </Section>

              <Section title="Pohledovy bok">
                {[
                  { field: "visibleSideLeft", label: "Levy bok" },
                  { field: "visibleSideRight", label: "Pravy bok" },
                ].map(({ field, label }) => (
                  <label key={field} className="flex cursor-pointer items-center gap-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={upper[field]}
                      onChange={(e) => setUpper(field, e.target.checked)}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </Section>

              <Section title="Horni rampa">
                <label className="flex cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={upper.topRailEnabled}
                    onChange={(e) => setUpper("topRailEnabled", e.target.checked)}
                  />
                  <span className="text-sm">Horni rampa</span>
                </label>
                {upper.topRailEnabled && (
                  <div className="mt-3 space-y-3 border-l-2 border-[#d6d0c4] pl-4">
                    <label className="block">
                      <span className="text-xs text-stone-500">Presah (mm)</span>
                      <input
                        type="number"
                        min={21}
                        value={upper.topRailOverhang}
                        onChange={(e) => setUpper("topRailOverhang", Number(e.target.value) || 21)}
                        className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={upper.topRailLed}
                        onChange={(e) => setUpper("topRailLed", e.target.checked)}
                      />
                      <span className="text-sm">Zafrezovana LED</span>
                    </label>
                    {upper.topRailLed && (
                      <div className="space-y-2">
                        <select
                          value={upper.topRailLedColor}
                          onChange={(e) => setUpper("topRailLedColor", e.target.value)}
                          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                        >
                          <option value="warm">Tepla bila</option>
                          <option value="cold">Studena bila</option>
                          <option value="neutral">Neutralni bila</option>
                          <option value="rgb">RGB</option>
                        </select>
                        <select
                          value={upper.topRailLedControl}
                          onChange={(e) => setUpper("topRailLedControl", e.target.value)}
                          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                        >
                          <option value="switch">Vypinac</option>
                          <option value="dimmer">Stmivac</option>
                          <option value="smart">Smart / WiFi</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Spodni rampa">
                <label className="flex cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={upper.bottomRailEnabled}
                    onChange={(e) => setUpper("bottomRailEnabled", e.target.checked)}
                  />
                  <span className="text-sm">Spodni rampa</span>
                </label>
                {upper.bottomRailEnabled && (
                  <div className="mt-3 space-y-3 border-l-2 border-[#d6d0c4] pl-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={upper.bottomRailLed}
                        onChange={(e) => setUpper("bottomRailLed", e.target.checked)}
                      />
                      <span className="text-sm">LED lista</span>
                    </label>
                    {upper.bottomRailLed && (
                      <div className="space-y-2">
                        <select
                          value={upper.bottomRailLedType}
                          onChange={(e) => setUpper("bottomRailLedType", e.target.value)}
                          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                        >
                          <option value="CORNER_OVERLAY">Rohova nalozana</option>
                          <option value="ROUTED">Zafrezovana do rampy</option>
                        </select>
                        <select
                          value={upper.bottomRailLedColor}
                          onChange={(e) => setUpper("bottomRailLedColor", e.target.value)}
                          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                        >
                          <option value="warm">Tepla bila</option>
                          <option value="cold">Studena bila</option>
                          <option value="neutral">Neutralni bila</option>
                          <option value="rgb">RGB</option>
                        </select>
                        <select
                          value={upper.bottomRailLedControl}
                          onChange={(e) => setUpper("bottomRailLedControl", e.target.value)}
                          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                        >
                          <option value="switch">Vypinac</option>
                          <option value="dimmer">Stmivac</option>
                          <option value="smart">Smart / WiFi</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Otevirani dvirka">
                {[
                  {
                    value: "HANDLE",
                    label: "Plny material – pant s dotahem",
                    hint: "Nalozny pant s dotahem + uchytka",
                  },
                  {
                    value: "HANDLE_BAR",
                    label: "Plny material – pant s dotahem + lista",
                    hint: "Nalozny pant s dotahem + lista uchytka",
                  },
                  {
                    value: "TIP_ON",
                    label: "Tip-on – pant bez dotahu",
                    hint: "Nalozny pant bez dotahu + tip-on",
                  },
                  {
                    value: "GLASS_ALU",
                    label: "Prosklena – hlinikovy ramecek",
                    hint: "Alu ramecek + pant s dotahem",
                  },
                  {
                    value: "FLAP",
                    label: "Vyklopna – Blum + tip-on",
                    hint: "Plny material + Aventos vyklop + tip-on",
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`mb-2 flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition ${
                      upper.doorType === opt.value
                        ? "border-[#8b5a2b] bg-[#f3ebe0]"
                        : "border-[#d6d0c4] hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="doorType"
                      value={opt.value}
                      className="mt-1"
                      checked={upper.doorType === opt.value}
                      onChange={() => setUpper("doorType", opt.value)}
                    />
                    <span>
                      <span className="block text-sm">{opt.label}</span>
                      <span className="block text-xs text-stone-400">{opt.hint}</span>
                    </span>
                  </label>
                ))}
                {upper.doorType === "HANDLE" && handles.length > 0 && (
                  <label className="mt-2 block">
                    <span className="text-xs text-stone-500">Uchytka</span>
                    <select
                      value={upper.handleId}
                      onChange={(e) => setUpper("handleId", Number(e.target.value) || "")}
                      className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">— vyberte —</option>
                      {handles.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                          {h.price != null ? ` · ${h.price} Kc` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {upper.doorType === "HANDLE_BAR" && (
                  <label className="mt-2 block">
                    <span className="text-xs text-stone-500">Vyska listy (mm)</span>
                    <input
                      type="number"
                      min={0}
                      value={upper.handleBarHeight}
                      onChange={(e) => setUpper("handleBarHeight", Number(e.target.value) || 0)}
                      className="mt-1 w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                )}
              </Section>

              {["HANDLE", "HANDLE_BAR", "TIP_ON", "GLASS_ALU"].includes(upper.doorType) && (
              <Section title="Panty">
                <p className="mb-2 text-xs text-stone-400">
                  Auto: do 1 199 mm = 2 ks · od 1 200 mm = 3 ks na kridlo
                  {upper.doorType === "TIP_ON" ? " · bez dotahu" : " · s dotahem"}
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={upper.hingeOverride !== null}
                    onChange={(e) => setUpper("hingeOverride", e.target.checked ? 2 : null)}
                  />
                  Prepsat rucne
                </label>
                {upper.hingeOverride !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUpper("hingeOverride", Math.max(1, upper.hingeOverride - 1))}
                      className="h-7 w-7 border border-[#d6d0c4] hover:bg-white"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{upper.hingeOverride}</span>
                    <button
                      type="button"
                      onClick={() => setUpper("hingeOverride", Math.min(6, upper.hingeOverride + 1))}
                      className="h-7 w-7 border border-[#d6d0c4] hover:bg-white"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpper("hingeOverride", null)}
                      className="ml-1 text-xs text-stone-400 hover:text-red-600"
                    >
                      reset
                    </button>
                  </div>
                )}
              </Section>
              )}
            </>
          )}
        </div>

        <BomPreview
          bom={bom}
          advice={advice}
          loading={loading}
          error={error}
          dimensions={form}
          templateName={template.name}
          templateId={template.id}
          orderExtras={isUpper ? upper : {}}
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
