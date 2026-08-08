import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Korpus</h1>
      <p className="mt-3 max-w-xl text-lg text-stone-600">
        Cabinet ERP – katalog, šablony, BOM a import ceníků dodavatelů.
      </p>
      <div className="mt-8">
        <Link
          to="/import"
          className="inline-flex rounded-md bg-[#8b5a2b] px-4 py-2 text-sm font-medium text-[#f7f4ee] hover:bg-[#734820]"
        >
          Importovat ceník
        </Link>
      </div>
    </main>
  );
}
