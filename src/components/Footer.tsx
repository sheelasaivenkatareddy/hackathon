import { Link } from "react-router-dom";

declare const __BUILD__: string;

// Shown on the About page. The photo, map and model licences require this credit.
export const REFERENCES: [string, string][] = [
  ["PlantVillage", "https://arxiv.org/abs/1511.08060"],
  ["PlantDoc", "https://arxiv.org/abs/1911.10317"],
  ["Mohanty et al. 2016", "https://doi.org/10.3389/fpls.2016.01419"],
  ["Calibration (Guo et al. 2017)", "https://arxiv.org/abs/1706.04599"],
  ["Hutton criteria (AHDB)", "https://potatoes.ahdb.org.uk/development-and-implementation-of-a-new-national-warning-system-for-potato-late-blight-in-great-britain-hutton-criteria"],
  ["Open-Meteo", "https://open-meteo.com/"],
  ["OpenStreetMap", "https://www.openstreetmap.org/copyright"],
];
export const PHOTO_CREDIT = "Leaf photos: PlantDoc dataset (Singh et al., 2020, CC BY 4.0) and PlantVillage dataset (Hughes & Salathé, 2015, CC BY-SA 3.0). blurry-photo, dark-photo and the test pairs are edited copies.";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["Leaf Watch", "/watch"], ["Scan a leaf", "/scan"], ["Risk Score", "/risk"], ["Disease Radar", "/radar"]] },
  { title: "More", links: [["My scans", "/history"], ["Disease library", "/diseases"], ["About", "/about"], ["Expert", "/expert"], ["Settings", "/settings"]] },
];

export default function Footer() {
  return (
    <footer className="bg-forest text-white">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr] md:py-16">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 font-heading text-xl font-extrabold">
            <img src="/logo-light.svg" alt="" className="h-9 w-9" />Patra Lens
          </Link>
          <p className="mt-3 max-w-sm text-white/75">Catch the first spot. Early detection of crop pests and diseases, on any smartphone.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-lime">{c.title}</h2>
            <ul className="mt-3 space-y-1">
              {c.links.map(([label, to]) => (
                <li key={to}><Link to={to} className="inline-flex min-h-[36px] items-center text-white/85 transition-colors hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-sm text-white/65">
          <p>© 2026 Patra Lens · <span data-testid="version">Version {__BUILD__}</span></p>
          <Link to="/about" className="inline-flex min-h-[36px] items-center underline-offset-4 hover:text-white hover:underline">Credits and licences</Link>
        </div>
      </div>
    </footer>
  );
}
