// What to look for, and what can be done about it. Written as plain advice, from extension and research sources.
// Patra Chain - Blockchain-based crop disease verification system never names products or doses. Those depend on the crop, the disease, the stage and local rules.
import type { AnswerLevel } from "./model";
import type { Source } from "./nutrition";

export const KCC = { number: "1800-180-1551", tel: "18001801551", hours: "6 AM to 10 PM, every day", source: { name: "Kisan Call Centre (Ministry of Agriculture)", url: "https://mkisan.gov.in/Home/AboutKCC" } satisfies Source };

// ------------------------------------------------------------------ symptom checklists
const RINGED = ["Dark brown spots with rings inside them, like a target", "Spots start on the older, lower leaves", "A yellow edge forms around the spots", "Badly hit leaves turn yellow and drop"];
const LATE = ["Large, dark, water-soaked patches that look greasy", "White fuzzy growth under the leaf in damp weather", "It spreads fast in cool, wet weather", "Brown marks can reach the stems and fruit"];
const BACTERIAL = ["Small, dark spots that look wet at first", "A yellow halo around the spots", "Rough, scabby marks on the fruit", "Worse after rain or overhead watering"];
const POWDERY = ["A white, powdery coating on the leaf", "It starts as small white patches", "Leaves turn yellow, curl or dry up as it spreads"];

export const SYMPTOMS: Record<string, string[]> = {
  "Early blight": RINGED, "Potato: Early blight": RINGED,
  "Late blight": LATE, "Potato: Late blight": LATE,
  "Septoria leaf spot": ["Many small, round spots with grey-white centres and dark edges", "Tiny black dots in the middle of the spots", "It starts on the lower leaves", "Leaves turn yellow and fall"],
  "Bacterial spot": BACTERIAL, "Bell pepper: Bacterial spot": BACTERIAL,
  "Leaf mold": ["Pale yellow patches on the top of the leaf", "Olive-green to grey fuzzy mould on the underside", "Worse in warm, humid, still air", "Leaves curl and dry up"],
  "Tomato mosaic virus": ["Light and dark green patches, like a mosaic", "Leaves are twisted, narrow or fern-like", "The plant grows slowly", "Fruit may ripen unevenly"],
  "Tomato yellow leaf curl virus": ["Leaves curl upward and turn yellow at the edges", "Leaves are small and crumpled", "The plant is stunted and bushy", "Tiny white whiteflies sit under the leaves"],
  "Corn: Gray leaf spot": ["Narrow, rectangular spots, tan to grey", "Spots run between the leaf veins", "It starts on the lower leaves", "Worse in warm, humid weather"],
  "Corn: Northern leaf blight": ["Long, cigar-shaped lesions, grey-green or tan", "Lesions can be several centimetres long", "It spreads from lower to upper leaves"],
  "Corn: Common rust": ["Small, reddish-brown raised bumps on both sides of the leaf", "The bumps release powdery, rust-coloured spores", "The leaf turns yellow around heavy patches"],
  "Apple: Apple scab": ["Olive-green to brown, velvety spots on leaves", "Leaves can turn yellow and drop early", "Rough, scabby marks on the fruit"],
  "Apple: Cedar apple rust": ["Bright yellow-orange spots on the leaves", "Tiny dark dots in the middle of the spots", "Spots can also form on the fruit"],
  "Grape: Black rot": ["Round tan spots with dark edges on the leaves", "Tiny black dots inside the spots", "Fruit shrivels into hard black mummies"],
  "Squash: Powdery mildew": POWDERY, "Cherry: Powdery mildew": POWDERY,
};
const HEALTHY_SYMPTOMS = ["An even green colour", "No spots, holes or yellow patches", "No curling or twisting"];

export function symptomsFor(name?: string): string[] | undefined {
  if (!name) return undefined;
  return name.endsWith("Healthy") ? HEALTHY_SYMPTOMS : SYMPTOMS[name];
}

// ------------------------------------------------------------------ treatment options
export interface TreatmentBlock { title: string; items: string[]; note?: string; source?: Source }
export interface Treatment { cultural: TreatmentBlock; organic: TreatmentBlock; chemical: TreatmentBlock }

const EXT: Source = { name: "UMass Extension", url: "https://www.umass.edu/agriculture-food-environment/vegetable/fact-sheets/tomato-leaf-blights" };
const BIO: Source = { name: "Indian Journal of Horticulture", url: "https://journal.iahs.org.in/index.php/ijh/article/view/1503" };
const LABEL: Source = { name: "ICAR–NRCG pesticide annexure", url: "https://apeda.gov.in/sites/default/files/export_procedures/Annexure_5_Grapenet17092025.pdf" };
const TNAU_VIRUS: Source = { name: "TNAU Agritech Portal", url: "https://agritech.tnau.ac.in/crop_protection/tomato/tomato_4.html" };

const LEAF_DISEASE_CULTURAL = [
  "Remove badly affected leaves and burn or bury them. Do not put them in the compost.",
  "Water at the base of the plant, in the morning. Try not to wet the leaves.",
  "Give plants room, so air moves between them. Remove the lowest leaves on staked plants.",
  "Wash your hands and tools after touching sick plants.",
  "Next season, do not plant the same crop family in the same plot. Ask your KVK for resistant varieties.",
];

const SAFE_USE = [
  "Sprays can protect healthy leaves. They do not repair spots that are already there.",
  "Use only products registered in India for your crop and this disease. Read the label, or ask your KVK or agriculture officer which one to use.",
  "Follow the label for the dose and the number of sprays. Never mix your own stronger dose.",
  "Keep to the waiting time (pre-harvest interval) before you pick.",
  "Wear gloves, a mask and long sleeves. Do not spray in wind or just before rain. Keep children and animals away.",
  "Do not keep using the same product. Resistance to some fungicide groups has already been found in India.",
];
const NO_NAMES = "Patra Chain - Blockchain-based crop disease verification system does not name products or doses. They depend on your crop, the stage and local rules.";

const NO_ORGANIC: TreatmentBlock = { title: "Organic and biological options", items: ["We have no checked organic remedy for this one. The steps under Cultural are your best first move, and your KVK can advise on more."] };

export function treatmentFor(name: string | undefined, level: AnswerLevel): Treatment | null {
  if (!name || level === "RETAKE") return null;
  const unsure = level !== "CLEAR";
  if (unsure) {
    return {
      cultural: { title: "Safe first steps", items: ["Remove any badly affected leaves and keep them away from the plants.", "Water at the base of the plant, in the morning.", "Photograph the same leaf again in 2–3 days.", "Ask an expert to confirm what this is before you treat it."] },
      organic: NO_ORGANIC,
      chemical: { title: "Chemical guidelines", items: ["Please do not spray anything until an expert confirms the problem. The wrong product costs money and can harm the crop."], note: NO_NAMES },
    };
  }
  if (name.endsWith("Healthy")) return null;
  if (name.includes("virus")) {
    const leafCurl = name.includes("yellow leaf curl");
    return {
      cultural: {
        title: "Cultural steps",
        items: [
          "Plants do not recover from a virus. Ask your KVK about removing infected plants, to protect the rest.",
          ...(leafCurl ? ["Control whiteflies, which spread this virus.", "Keep weeds down, because they can host the virus and the whiteflies."] : ["Wash your hands and tools after touching sick plants. This virus spreads on hands and tools."]),
          "Use clean seed and healthy seedlings next season.",
        ],
        source: leafCurl ? TNAU_VIRUS : undefined,
      },
      organic: NO_ORGANIC,
      chemical: { title: "Chemical guidelines", items: ["No spray cures a virus.", ...(leafCurl ? ["Sprays only help against the whiteflies that carry it. Ask your KVK what is registered, and follow the label."] : []), ...SAFE_USE.slice(2, 5)], note: NO_NAMES, source: LABEL },
    };
  }
  const bacterial = name.includes("Bacterial");
  const lateBlight = name.includes("Late blight");
  const earlyBlight = name.includes("Early blight");
  return {
    cultural: { title: "Cultural steps", items: bacterial ? ["Do not work among the plants while they are wet.", ...LEAF_DISEASE_CULTURAL, "Use disease-free seed."] : LEAF_DISEASE_CULTURAL, source: EXT },
    organic: earlyBlight ? {
      title: "Organic and biological options",
      items: [
        "In field trials in India, the bio-agents Trichoderma and Pseudomonas fluorescens reduced tomato early blight. One study found up to 62% less disease, using a seedling dip and a leaf spray.",
        "They work best before the disease is heavy. Ask your KVK for a registered bio-agent product and how to use it.",
      ],
      note: "These are research results from one set of trials. They are not a replacement for the cultural steps.",
      source: BIO,
    } : NO_ORGANIC,
    chemical: {
      title: "Chemical guidelines",
      items: bacterial ? ["Sprays have only a limited effect on bacterial diseases. Prevention matters more.", ...SAFE_USE.slice(1)] : lateBlight ? ["Late blight can spread very fast in cool, wet weather. Ask your KVK early, because timing matters.", ...SAFE_USE] : SAFE_USE,
      note: NO_NAMES,
      source: LABEL,
    },
  };
}
