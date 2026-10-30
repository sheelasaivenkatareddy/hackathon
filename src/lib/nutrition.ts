// Fertilizer guidance shown after a diagnosis. Types only: the amount depends on the soil and must come from a soil test.
// Each profile states only what its source supports. Where no link was confirmed, the advice stays general and says so.
import type { AnswerLevel } from "./model";

export interface Source { name: string; url: string }
export interface FertilizerAdvice {
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
  headline: "Keep feeding balanced",
  consider: [BALANCED, ORGANIC],
  avoid: ["Adding extra fertilizer in the hope of curing the problem"],
  why: "We could not confirm that any fertilizer helps with this problem. Balanced feeding keeps the plant strong while you deal with the cause.",
  specific: false,
};

const EARLY_BLIGHT: FertilizerAdvice = {
  headline: "Keep nitrogen adequate, not excessive",
  consider: [NITROGEN, BALANCED],
  avoid: ["Letting the plant run short of nitrogen as the fruit load grows", "Heavy nitrogen feeds"],
  why: "Early blight tends to be worse on plants short of nitrogen. Adequate feeding through the season can help delay it, but too much brings other problems.",
  source: { name: "UMass Extension", url: "https://www.umass.edu/agriculture-food-environment/vegetable/fact-sheets/tomato-leaf-blights" },
  specific: true,
};

const POWDERY_MILDEW: FertilizerAdvice = {
  headline: "Go easy on late nitrogen",
  consider: [BALANCED, POTASH],
  avoid: ["Nitrogen feeds late in the season, once the disease has appeared"],
  why: "Late nitrogen produces soft new growth, which powdery mildew infects more easily.",
  source: { name: "Maine Department of Agriculture", url: "https://www1.maine.gov/DACF/php/gotpests/diseases/factsheets/powder-mildew-col.pdf" },
  specific: true,
};

const BACTERIAL_SPOT: FertilizerAdvice = {
  headline: "Keep nitrogen and potassium adequate",
  consider: [BALANCED, POTASH],
  avoid: ["Letting the crop run low on nitrogen"],
  why: "In a tomato study, plants given more nitrogen and potassium carried fewer bacteria, and leaf loss was worse at low nitrogen. This was one study, on tomato.",
  source: { name: "Phytopathology, 1991", url: "https://www.apsnet.org/publications/phytopathology/backissues/Documents/1991Abstracts/Phyto81_656.htm" },
  specific: true,
};

const LEAF_CURL: FertilizerAdvice = {
  headline: "No fertilizer cures this virus",
  consider: [BALANCED],
  avoid: ["Too much nitrogen: lush, soft growth attracts the whiteflies that spread this virus"],
  why: "Infected plants do not recover. Control the whiteflies and ask your KVK about removing infected plants. Use nitrogen with care.",
  source: { name: "TNAU Agritech Portal", url: "https://agritech.tnau.ac.in/crop_protection/tomato/tomato_4.html" },
  specific: true,
};

const MOSAIC: FertilizerAdvice = {
  headline: "No fertilizer cures this virus",
  consider: [BALANCED],
  avoid: ["Adding extra fertilizer in the hope of curing the plant"],
  why: "Feeding can keep the rest of the crop strong, but it will not clear the virus. Ask your KVK about removing infected plants.",
  specific: true,
};

const CORN: FertilizerAdvice = {
  headline: "Keep nitrogen and potassium in balance",
  consider: [BALANCED, POTASH],
  avoid: ["High nitrogen without enough potassium"],
  why: "Well-balanced fertility is a supporting step. Resistant hybrids, crop rotation and managing residue matter more for these corn diseases.",
  source: { name: "LSU AgCenter", url: "https://www.lsuagcenter.com/~/media/system/2/e/4/0/2e40f4d1dd1e8dce7b732afd272a8838/p1802_2025-louisianaplantdiseasecornpdf.pdf" },
  specific: true,
};

const HEALTHY: FertilizerAdvice = {
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
