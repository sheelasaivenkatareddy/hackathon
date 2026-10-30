export const REFERENCES: [string, string][] = [
  ["PlantVillage", "https://arxiv.org/abs/1511.08060"],
  ["PlantDoc", "https://arxiv.org/abs/1911.10317"],
  ["Mohanty et al. 2016", "https://doi.org/10.3389/fpls.2016.01419"],
  ["MobileNetV3", "https://arxiv.org/abs/1905.02244"],
  ["Grad-CAM", "https://arxiv.org/abs/1610.02391"],
  ["Calibration (Guo et al. 2017)", "https://arxiv.org/abs/1706.04599"],
  ["Hutton criteria (AHDB)", "https://potatoes.ahdb.org.uk/development-and-implementation-of-a-new-national-warning-system-for-potato-late-blight-in-great-britain-hutton-criteria"],
  ["Open-Meteo", "https://open-meteo.com/"],
  ["OpenStreetMap", "https://www.openstreetmap.org/copyright"],
];
export const PHOTO_CREDIT = "Leaf photos: PlantDoc dataset (Singh et al., 2020, CC BY 4.0) and PlantVillage dataset (Hughes & Salathé, 2015, CC BY-SA 3.0). blurry-photo, dark-photo and the test pairs are edited copies.";

export default function Footer() {
  return (
    <footer className="bg-forest text-white">
      <div className="wrap py-12">
        <div className="flex items-center gap-3">
          <img src="/logo-light.svg" alt="" className="h-10 w-10" />
          <p className="font-semibold">Patra Lens · Prototype for Chip to Crop 2026 · Team Smart Revolution</p>
        </div>
        <h2 className="mt-8 font-heading text-base font-bold text-lime">References</h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {REFERENCES.map(([name, href]) => (
            <li key={href}><a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-[32px] items-center text-sm text-white/90 underline underline-offset-2 hover:text-white">{name}</a></li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-white/80">{PHOTO_CREDIT}</p>
      </div>
    </footer>
  );
}
