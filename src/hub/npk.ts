// Smart fertilizer and NPK calculator. General recommended doses (kg per hectare of N, P2O5, K2O), changed by the
// soil test level (low +25%, medium as is, high -25%, the usual soil-test rule), then turned into bags of
// DAP, urea and potash. Approximate: a soil test card and the state package of practices come first.
import { CROP_DOSES } from "../lib/nutrition";

export interface CropRdf { crop: string; n: number; p: number; k: number; splits: string; source: string }

const tomato = CROP_DOSES.find((c) => c.crop === "Tomato")!;
export const RDF: CropRdf[] = [
  { crop: "Paddy", n: 120, p: 60, k: 40, splits: "N in 3 equal splits: at planting, at tillering (about 25 days) and at panicle initiation (about 50 days). All P at planting. K half at planting, half at panicle initiation.", source: "General irrigated kharif recommendation, AP & Telangana" },
  { crop: "Tomato", n: tomato.n, p: tomato.p, k: tomato.k, splits: "Give all the DAP, a quarter of the urea and 2 parts in 5 of the potash at planting. Split the rest over 30, 45 and 60 days after planting.", source: "TNAU, hybrid tomato" },
  { crop: "Cotton", n: 120, p: 60, k: 60, splits: "N in 3 splits at 30, 60 and 90 days. All P and half the K at sowing, the rest of the K at flowering.", source: "General Bt cotton recommendation" },
  { crop: "Dry Chilli", n: 150, p: 75, k: 75, splits: "All P and a quarter of N and K at transplanting. The rest in 3 splits at 30, 60 and 90 days.", source: "General irrigated chilli guide" },
  { crop: "Maize", n: 150, p: 75, k: 75, splits: "A third of N, all P and half K at sowing. N at knee-high stage and at tasselling, the rest of K at tasselling.", source: "TNAU, hybrid maize" },
  { crop: "Groundnut", n: 20, p: 40, k: 40, splits: "All at sowing. Gypsum 200 kg per acre at flowering (40-45 days) for pod filling.", source: "General rain-fed groundnut guide" },
  { crop: "Onion", n: 100, p: 50, k: 50, splits: "Half N, all P and K at planting. The rest of N at 30 and 45 days.", source: "General onion guide" },
];

export type SoilLevel = "low" | "medium" | "high";
export const SOIL_FACTOR: Record<SoilLevel, number> = { low: 1.25, medium: 1, high: 0.75 };

// Product grades and bag sizes. MRP is approximate and subsidised; it changes.
export const PRODUCTS = {
  dap: { name: "DAP (18-46-0)", bag: 50, mrp: 1350 },
  urea: { name: "Urea (46% N)", bag: 45, mrp: 266.5 },
  mop: { name: "Muriate of potash (60% K₂O)", bag: 50, mrp: 1700 },
};

export interface NpkInput { crop: string; acres: number; soil: { n: SoilLevel; p: SoilLevel; k: SoilLevel }; organic: boolean }
export interface NpkResult {
  nutrient: { n: number; p: number; k: number }; // kg for the whole area
  products: { name: string; kg: number; bags: number; cost: number }[];
  total: number; rdf: CropRdf;
}

export function calculate(i: NpkInput): NpkResult {
  const rdf = RDF.find((r) => r.crop === i.crop) ?? RDF[0];
  const ha = i.acres * 0.4047;
  // Well-rotted FYM or compost (about 4 t/acre) supplies some N: take 10% off.
  const n = rdf.n * SOIL_FACTOR[i.soil.n] * (i.organic ? 0.9 : 1) * ha;
  const p = rdf.p * SOIL_FACTOR[i.soil.p] * ha;
  const k = rdf.k * SOIL_FACTOR[i.soil.k] * ha;
  const dapKg = p / 0.46;
  const ureaKg = Math.max(0, (n - dapKg * 0.18) / 0.46);
  const mopKg = k / 0.6;
  const products = ([["dap", dapKg], ["urea", ureaKg], ["mop", mopKg]] as const).map(([id, kg]) => {
    const pr = PRODUCTS[id];
    const bags = Math.round((kg / pr.bag) * 10) / 10;
    return { name: pr.name, kg: Math.round(kg), bags, cost: Math.round((kg / pr.bag) * pr.mrp) };
  });
  return { nutrient: { n: Math.round(n), p: Math.round(p), k: Math.round(k) }, products, total: products.reduce((s, x) => s + x.cost, 0), rdf };
}
