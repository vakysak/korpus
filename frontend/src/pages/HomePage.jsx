import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Korpus</h1>
      <p className="mt-3 max-w-xl text-lg text-stone-600">
        Cabinet ERP – katalog skříněk, live BOM a import ceníků.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/catalog"
          className="inline-flex bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] hover:bg-[#734820]"
        >
          Otevřít katalog
        </Link>
        <Link
          to="/import"
          className="inline-flex border border-[#d6d0c4] px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white"
        >
          Import ceníku
        </Link>
      </div>
    </main>
  );
}
