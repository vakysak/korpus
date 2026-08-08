import { useEffect, useRef, useState } from "react";

const SUPPLIERS = ["demos", "trust", "egger", "blum", "hettich"];

const STATUS_COLOR = {
  OK: "text-emerald-700",
  PARTIAL: "text-amber-700",
  FAILED: "text-red-700",
};

export default function ImportPage() {
  const [supplier, setSupplier] = useState("demos");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const r = await fetch("/api/import/history");
      const d = await r.json();
      if (Array.isArray(d)) setHistory(d);
    } catch {
      /* ignore */
    }
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("supplier", supplier);
      fd.append("file", file);
      const r = await fetch("/api/import/preview", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Náhled selhal");
      setPreview(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("supplier", supplier);
      fd.append("file", file);
      const r = await fetch("/api/import/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Import selhal");
      setResult(d);
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Import ceníku</h1>

      <div className="space-y-4 border border-[#d6d0c4] bg-[#faf8f3] p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-stone-700">Dodavatel</label>
            <select
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setPreview(null);
                setResult(null);
              }}
              className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
            >
              {SUPPLIERS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-[2]">
            <label className="mb-1 block text-sm text-stone-700">CSV soubor</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
              className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || loading}
            className="border border-[#d6d0c4] px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-white"
          >
            Náhled
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || loading}
            className="bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] disabled:opacity-40 hover:bg-[#734820]"
          >
            {loading ? "Zpracovávám…" : "Importovat"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {preview && (
        <div className="space-y-3 border border-[#d6d0c4] bg-[#faf8f3] p-6">
          <h2 className="font-semibold">
            Náhled – {preview.supplier}
            <span className="ml-2 text-sm font-normal text-stone-500">
              {preview.materialCount} materiálů · {preview.hardwareCount} kování
            </span>
          </h2>
          {preview.materialSample?.length > 0 && (
            <SampleTable
              title="Materiály"
              rows={preview.materialSample}
              cols={["supplierCode", "name", "category", "thickness", "price", "unit", "inStock"]}
            />
          )}
          {preview.hardwareSample?.length > 0 && (
            <SampleTable
              title="Kování"
              rows={preview.hardwareSample}
              cols={["supplierCode", "name", "type", "packQty", "price", "inStock"]}
            />
          )}
        </div>
      )}

      {result && (
        <div className="space-y-2 border border-[#d6d0c4] bg-[#faf8f3] p-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Výsledek</span>
            <span className={`text-sm font-medium ${STATUS_COLOR[result.status] || ""}`}>
              {result.status}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Stat label="Materiály přidány" value={result.matAdded} />
            <Stat label="Materiály aktualizovány" value={result.matUpdated} />
            <Stat label="Kování přidáno" value={result.hwAdded} />
            <Stat label="Kování aktualizováno" value={result.hwUpdated} />
            {result.errorCount > 0 && (
              <Stat label="Chyby" value={result.errorCount} className="text-red-700" />
            )}
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-red-700">
              {result.errors.map((e, i) => (
                <div key={i}>
                  <span className="font-mono">{e.code}</span>: {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="border border-[#d6d0c4] bg-[#faf8f3] p-6">
          <h2 className="mb-3 font-semibold">Historie importů</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#d6d0c4] text-left text-stone-500">
                  <th className="pb-2">Datum</th>
                  <th className="pb-2">Dodavatel</th>
                  <th className="pb-2">Soubor</th>
                  <th className="pb-2 text-right">Mat+</th>
                  <th className="pb-2 text-right">Mat~</th>
                  <th className="pb-2 text-right">Kování</th>
                  <th className="pb-2 text-right">Chyby</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} className="border-b border-[#e8e2d6] last:border-0">
                    <td className="py-2 text-xs text-stone-500">
                      {new Date(log.createdAt).toLocaleString("cs-CZ")}
                    </td>
                    <td className="py-2 font-medium">{log.supplier?.name}</td>
                    <td className="max-w-[140px] truncate py-2 text-xs text-stone-600">
                      {log.fileName}
                    </td>
                    <td className="py-2 text-right">{log.matAdded}</td>
                    <td className="py-2 text-right">{log.matUpdated}</td>
                    <td className="py-2 text-right">{log.hwAdded + log.hwUpdated}</td>
                    <td className="py-2 text-right text-red-600">
                      {log.errorCount > 0 ? log.errorCount : "–"}
                    </td>
                    <td className={`py-2 font-medium ${STATUS_COLOR[log.status] || ""}`}>
                      {log.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className = "" }) {
  return (
    <div className={`flex justify-between border-b border-[#e8e2d6] pb-1 ${className}`}>
      <span className="text-stone-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SampleTable({ title, rows, cols }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-stone-600">{title} (prvních 5)</p>
      <div className="overflow-x-auto">
        <table className="w-full rounded border border-[#d6d0c4] text-xs">
          <thead className="bg-[#f0ebe2]">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#e8e2d6]">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1">
                    {row[c] === true ? "✓" : row[c] === false ? "✗" : (row[c] ?? "–")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
