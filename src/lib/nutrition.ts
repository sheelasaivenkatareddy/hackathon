// Action plan shown after a diagnosis: what to use, approximately how much, and what to expect.
// Each profile states only what its source supports. Where no link was confirmed, the advice stays general and says so.
import type { AnswerLevel, Guess } from "./model";

// ------------------------------------------------------------------ approximate amounts for the whole crop
export interface CropDose { crop: string; label: string; n: number; p: number; k: number; timing: string; source: Source }
const TNAU = (path: string): Source => ({ name: "TNAU Agritech Portal", url: `https://agritech.tnau.ac.in/${path}` });

// kg per hectare of N, P2O5 and K2O, as general recommendations for Tamil Nadu. Soil test results replace these.
// Checked against the TNAU pages on 31 Oct 2026. The potato page writes "P" and "K"; we read them as P2O5 and K2O, the usual convention.
export const CROP_DOSES: CropDose[] = [
  { crop: "Tomato", label: "Tomato (hybrid)", n: 200, p: 250, k: 250, timing: "Give all the SSP, a quarter of the urea and 2 parts in 5 of the potash at planting. Split the rest over 30, 45 and 60 days after planting.", source: TNAU("horticulture/horti_vegetables_tomato_irrigation.html") },
  { crop: "Potato", label: "Potato", n: 120, p: 240, k: 120, timing: "Give half at planting and the other half 30 days later.", source: TNAU("horticulture/horti_veg_fert_potato.html") },
  { crop: "Corn", label: "Corn (hybrid, drip-fed)", n: 150, p: 75, k: 75, timing: "This dose is listed for drip feeding, split across the crop stages. Do not give it all at once.", source: TNAU("agriculture/millets_maize_irrigated_maize_water_fertigation.html") },
];

export const AREA_UNITS = [
  { id: "acre", label: "acres", hectares: 0.4047 },
  { id: "cent", label: "cents", hectares: 0.004047 },
  { id: "sqm", label: "square metres", hectares: 0.0001 },
] as const;

const round = (kg: number) => (kg >= 50 ? Math.round(kg / 5) * 5 : kg >= 5 ? Math.round(kg) : Math.round(kg * 10) / 10);

/** Common fertilizers: urea is 46% N, single super phosphate 16% P2O5, muriate of potash 60% K2O. */
export function doseFor(dose: CropDose, hectares: number) {
  return [
    { product: "Urea", kg: round((dose.n / 0.46) * hectares) },
    { product: "Single super phosphate (SSP)", kg: round((dose.p / 0.16) * hectares) },
    { product: "Muriate of potash (MOP)", kg: round((dose.k / 0.6) * hectares) },
  ];
}

export function plantOf(top?: Guess): string | undefined {
  const prefix = top?.label.split("___")[0];
  if (!prefix) return undefined;
  if (prefix.startsWith("Corn")) return "Corn";
  if (prefix.startsWith("Pepper")) return "Bell pepper";
  if (prefix.startsWith("Cherry")) return "Cherry";
  return prefix;
}

// ------------------------------------------------------------------ what to expect
export type Outlook = "spots" | "virus" | "healthy" | "unsure";
export interface OutlookStep { when: string; what: string }

export function outlookFor(name: string | undefined, level: AnswerLevel): { kind: Outlook; headline: string; steps: OutlookStep[] } {
  if (!name || level !== "CLEAR") {
    return { kind: "unsure", headline: "We can't say yet, because the answer is not certain", steps: [
      { when: "Today", what: "Ask an expert or your KVK to confirm what this is." },
      { when: "In 2–3 days", what: "Photograph the same leaf again, to see whether it is changing." },
    ] };
  }
  if (name.endsWith("Healthy")) {
    return { kind: "healthy", headline: "Nothing to clear. The leaf looks healthy", steps: [
      { when: "Every few days", what: "Photograph the same leaf, so a first spot is caught early." },
    ] };
  }
  if (name.includes("virus")) {
    return { kind: "virus", headline: "This will not go away. Plants do not recover from a virus", steps: [
      { when: "Today", what: "Ask your KVK about removing infected plants, to protect the rest." },
      { when: "In 2–3 days", what: "Check nearby plants for the same signs." },
    ] };
  }
  return { kind: "spots", headline: "About 1–2 weeks to see it slowing, if it is being controlled", steps: [
    { when: "Today", what: "Remove badly affected lower leaves, and ask your KVK how to control this disease." },
    { when: "In 2–3 days", what: "Photograph the same leaf. Patra Chain rings any new spots." },
    { when: "In about 1–2 weeks", what: "If no new spots appear and new leaves stay clean, it is slowing." },
  ] };
}

// ------------------------------------------------------------------ what to use

export interface Source { name: string; url: string }
export interface FertilizerAdvice {
  useThis: string;
  headline: string;
  consider: string[];
  avoid: string[];
  why: string;
  source?: Source;
  /** True when the advice is specific to the top answer rather than general soil care. */
  specific: boolean;
}

const BALANCED = "A balanced NPK fertilizer, as your soil test advises";
const ORGANIC = "Compost or well-rotted farmyard manure";
const POTASH = "A potassium source: muriate of potash (MOP) or sulphate of potash (SOP)";
const NITROGEN = "A nitrogen source such as urea, split into smaller feeds instead of one large feed";

const GENERAL: FertilizerAdvice = {
  useThis: "Balanced NPK fertilizer",
  headline: "Keep feeding balanced",
  consider: [BALANCED, ORGANIC],
  avoid: ["Adding extra fertilizer in the hope of curing the problem"],
  why: "We could not confirm that any fertilizer helps with this problem. Balanced feeding keeps the plant strong while you deal with the cause.",
  specific: false,
};

const EARLY_BLIGHT: FertilizerAdvice = {
  useThis: "Urea in small split feeds, with balanced NPK",
  headline: "Keep nitrogen adequate, not excessive",
  consider: [NITROGEN, BALANCED],
  avoid: ["Letting the plant run short of nitrogen as the fruit load grows", "Heavy nitrogen feeds"],
  why: "Early blight tends to be worse on plants short of nitrogen. Adequate feeding through the season can help delay it, but too much brings other problems.",
  source: { name: "UMass Extension", url: "https://www.umass.edu/agriculture-food-environment/vegetable/fact-sheets/tomato-leaf-blights" },
  specific: true,
};

const POWDERY_MILDEW: FertilizerAdvice = {
  useThis: "Balanced NPK with potash, and no late nitrogen",
  headline: "Go easy on late nitrogen",
  consider: [BALANCED, POTASH],
  avoid: ["Nitrogen feeds late in the season, once the disease has appeared"],
  why: "Late nitrogen produces soft new growth, which powdery mildew infects more easily.",
  source: { name: "Maine Department of Agriculture", url: "https://www1.maine.gov/DACF/php/gotpests/diseases/factsheets/powder-mildew-col.pdf" },
  specific: true,
};

const BACTERIAL_SPOT: FertilizerAdvice = {
  useThis: "Balanced NPK with potash",
  headline: "Keep nitrogen and potassium adequate",
  consider: [BALANCED, POTASH],
  avoid: ["Letting the crop run low on nitrogen"],
  why: "In a tomato study, plants given more nitrogen and potassium carried fewer bacteria, and leaf loss was worse at low nitrogen. This was one study, on tomato.",
  source: { name: "Phytopathology, 1991", url: "https://www.apsnet.org/publications/phytopathology/backissues/Documents/1991Abstracts/Phyto81_656.htm" },
  specific: true,
};

const LEAF_CURL: FertilizerAdvice = {
  useThis: "Balanced NPK, with care on nitrogen",
  headline: "No fertilizer cures this virus",
  consider: [BALANCED],
  avoid: ["Too much nitrogen: lush, soft growth attracts the whiteflies that spread this virus"],
  why: "Infected plants do not recover. Control the whiteflies and ask your KVK about removing infected plants. Use nitrogen with care.",
  source: { name: "TNAU Agritech Portal", url: "https://agritech.tnau.ac.in/crop_protection/tomato/tomato_4.html" },
  specific: true,
};

const MOSAIC: FertilizerAdvice = {
  useThis: "Balanced NPK, for the rest of the crop",
  headline: "No fertilizer cures this virus",
  consider: [BALANCED],
  avoid: ["Adding extra fertilizer in the hope of curing the plant"],
  why: "Feeding can keep the rest of the crop strong, but it will not clear the virus. Ask your KVK about removing infected plants.",
  specific: true,
};

const CORN: FertilizerAdvice = {
  useThis: "Balanced NPK with potash",
  headline: "Keep nitrogen and potassium in balance",
  consider: [BALANCED, POTASH],
  avoid: ["High nitrogen without enough potassium"],
  why: "Well-balanced fertility is a supporting step. Resistant hybrids, crop rotation and managing residue matter more for these corn diseases.",
  source: { name: "LSU AgCenter", url: "https://www.lsuagcenter.com/~/media/system/2/e/4/0/2e40f4d1dd1e8dce7b732afd272a8838/p1802_2025-louisianaplantdiseasecornpdf.pdf" },
  specific: true,
};

const HEALTHY: FertilizerAdvice = {
  useThis: "Your usual balanced NPK feed",
  headline: "Keep doing what works",
  consider: [BALANCED, ORGANIC],
  avoid: ["Feeding more than the crop needs"],
  why: "The plant looks healthy, so there is no reason to change its feeding. Keep checking your sentinel leaves.",
  specific: true,
};

const BY_NAME: Record<string, FertilizerAdvice> = {
  "Early blight": EARLY_BLIGHT,
  "Bacterial spot": BACTERIAL_SPOT,
  "Tomato yellow leaf curl virus": LEAF_CURL,
  "Tomato mosaic virus": MOSAIC,
  "Squash: Powdery mildew": POWDERY_MILDEW,
  "Cherry: Powdery mildew": POWDERY_MILDEW,
  "Corn: Gray leaf spot": CORN,
  "Corn: Northern leaf blight": CORN,
  "Corn: Common rust": CORN,
};

/** Specific advice only when one answer stands out. A wrong diagnosis should not lead to a wrong feed. */
export function fertilizerAdvice(name: string | undefined, level: AnswerLevel): FertilizerAdvice {
  if (!name || level !== "CLEAR") return GENERAL;
  if (name.endsWith("Healthy")) return HEALTHY;
  return BY_NAME[name] ?? GENERAL;
}
