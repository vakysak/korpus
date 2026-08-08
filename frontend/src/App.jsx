import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import ImportPage from "./pages/ImportPage.jsx";
import HomePage from "./pages/HomePage.jsx";

const linkClass = ({ isActive }) =>
  `text-sm tracking-wide ${isActive ? "text-[#8b5a2b]" : "text-stone-600 hover:text-stone-900"}`;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <header className="border-b border-[#d6d0c4]/bg-[#f7f4ee]/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-6 px-6 py-5">
            <NavLink to="/" className="text-2xl font-semibold tracking-[0.04em] text-stone-900">
              Korpus
            </NavLink>
            <nav className="flex gap-5">
              <NavLink to="/" className={linkClass} end>
                Přehled
              </NavLink>
              <NavLink to="/import" className={linkClass}>
                Import ceníku
              </NavLink>
            </nav>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
