// Care plans used when the AI vision answer is not available: one plan per group of problems the on-device model knows.
// Doses are common label rates for products registered in India. The page always says to follow the product label.
import type { Advice, Detection, LeafResult } from "./cloud";
import type { Diagnosis } from "./diagnose";
import { plantOf } from "./nutrition";
import type { PhotoKind } from "./vision/regions";
import { RDF, calculate } from "../hub/npk";

type Care = LeafResult["care"];
type Group = "lateBlight" | "fungalSpot" | "leafMold" | "bacterial" | "virus" | "mites" | "mildew" | "healthy" | "unknown";

const SAFETY = "Follow the product label. Wear gloves, a mask and long sleeves when spraying, and keep to the waiting time before harvest.";
const BASE_WATER = [
  "Water at the base of the plant, in the early morning, so the leaves stay dry.",
  "Water deeply 2–3 times a week instead of a little every day; let the top 2–3 cm of soil dry between waterings.",
  "Make sure pots and beds drain. Standing water rots roots and spreads disease.",
];
const MULCH = "Mulch the soil with dry straw so rain does not splash soil onto the leaves.";

const CARE: Record<Group, Care> = {
  lateBlight: {
    do_today: ["Pick off every leaf with dark, water-soaked patches and burn or bury it. Do not compost it.", "Spray the whole plant, top and bottom of the leaves, today."],
    precautions: ["Late blight spreads in days in cool, wet weather. Check nearby tomato and potato plants.", "Do not touch healthy plants after sick ones without washing your hands.", SAFETY],
    watering: [...BASE_WATER, "Never use a hose or sprinkler on the leaves while the disease is active.", MULCH],
    fertilizer: [
      { product: "Stop extra urea", dose: "No extra nitrogen", when: "Until the disease stops spreading" },
      { product: "Potassium nitrate 13-0-45", dose: "5 g per litre, leaf spray", when: "Every 10 days, 2–3 times" },
      { product: "Calcium nitrate", dose: "2 g per litre", when: "Once a week, separate from other sprays" },
    ],
    chemical: [
      { product: "Metalaxyl 8% + Mancozeb 64% WP", dose: "2.5 g per litre", interval: "Repeat after 7–10 days" },
      { product: "Cymoxanil 8% + Mancozeb 64% WP", dose: "3 g per litre", interval: "Alternate with the one above" },
      { product: "Mancozeb 75% WP (protectant)", dose: "2.5 g per litre", interval: "Every 7 days in wet weather" },
    ],
    organic: [
      { product: "Copper oxychloride 50% WP", dose: "3 g per litre" },
      { product: "Pseudomonas fluorescens", dose: "10 g per litre, leaf spray" },
      { product: "Trichoderma harzianum", dose: "2.5 kg per acre mixed into 100 kg farmyard manure" },
    ],
    recovery: "Spots already there will not go green again. New leaves should stay clean within 7–10 days of the first spray if the weather dries.",
  },
  fungalSpot: {
    do_today: ["Remove the lowest spotted leaves and destroy them.", "Spray the plant, covering both sides of the leaves."],
    precautions: ["Spores live in old plant waste. Clean up fallen leaves.", "Next season, do not grow tomato, potato, brinjal or chilli in the same spot.", SAFETY],
    watering: [...BASE_WATER, MULCH],
    fertilizer: [
      { product: "Urea in small split feeds", dose: "About 5 g per plant every 2 weeks", when: "Do not let the plant run short of nitrogen" },
      { product: "Potassium nitrate 13-0-45", dose: "5 g per litre, leaf spray", when: "Every 10–15 days" },
    ],
    chemical: [
      { product: "Mancozeb 75% WP", dose: "2.5 g per litre", interval: "Every 7–10 days" },
      { product: "Chlorothalonil 75% WP", dose: "2 g per litre", interval: "Alternate with Mancozeb" },
      { product: "Azoxystrobin 23% SC", dose: "1 ml per litre", interval: "At most 2 sprays a season" },
    ],
    organic: [
      { product: "Trichoderma viride", dose: "5 g per litre, leaf spray" },
      { product: "Neem oil 1500 ppm", dose: "3–5 ml per litre with 1 ml liquid soap" },
    ],
    recovery: "Old spots stay. New leaves should be clean in 2–3 weeks.",
  },
  leafMold: {
    do_today: ["Turn a spotted leaf over: olive-green mould underneath confirms leaf mold.", "Remove the spotted leaves and the lowest 2–3 leaves to let air in."],
    precautions: ["Leaf mold needs still, humid air. Space the plants and open the area to wind.", "Indoors, run a fan and keep humidity under 85%.", SAFETY],
    watering: [...BASE_WATER, "Water only in the morning so the leaves dry by evening."],
    fertilizer: [
      { product: "Cut back urea", dose: "Half the usual nitrogen", when: "Soft, dense growth holds humidity" },
      { product: "Potassium nitrate 13-0-45", dose: "5 g per litre", when: "Every 10–15 days" },
      { product: "Calcium nitrate", dose: "2 g per litre", when: "Once a week" },
    ],
    chemical: [
      { product: "Chlorothalonil 75% WP", dose: "2 g per litre", interval: "Every 10–14 days, under the leaves" },
      { product: "Difenoconazole 25% EC", dose: "0.5 ml per litre", interval: "Alternate with the one above" },
    ],
    organic: [
      { product: "Bacillus subtilis", dose: "5 g per litre" },
      { product: "Potassium bicarbonate", dose: "5 g per litre" },
    ],
    recovery: "With better airflow, new spots should stop in 1–2 weeks.",
  },
  bacterial: {
    do_today: ["Remove spotted leaves while the plants are dry.", "Stop all overhead watering."],
    precautions: ["Bacteria spread on wet leaves, hands and tools. Do not work among wet plants.", "Use disease-free seed next season.", SAFETY],
    watering: [...BASE_WATER, MULCH],
    fertilizer: [
      { product: "Balanced NPK 19-19-19", dose: "5 g per litre", when: "Every 15 days" },
      { product: "Avoid heavy urea", dose: "No extra nitrogen", when: "While spots are spreading" },
    ],
    chemical: [
      { product: "Copper oxychloride 50% WP", dose: "3 g per litre", interval: "Every 7–10 days" },
      { product: "Copper hydroxide 77% WP", dose: "2 g per litre", interval: "Alternate with the one above" },
    ],
    organic: [{ product: "Pseudomonas fluorescens", dose: "10 g per litre" }],
    recovery: "Sprays slow the spread; they do not cure spots. Expect new leaves to stay cleaner after 2 weeks of dry weather.",
  },
  virus: {
    do_today: ["Pull out badly affected plants and destroy them, so the virus does not reach the rest.", "Look under the leaves for whiteflies or aphids."],
    precautions: ["No spray cures a virus. Control the insects that carry it.", "Wash hands and tools; tobacco users should wash before touching tomato.", "Use yellow sticky traps, 4–5 per 100 m².", SAFETY],
    watering: BASE_WATER,
    fertilizer: [
      { product: "Balanced NPK 19-19-19", dose: "5 g per litre", when: "Every 15 days, to keep healthy plants growing" },
      { product: "Micronutrient mix (zinc, boron)", dose: "As the label says", when: "Once a month" },
    ],
    chemical: [
      { product: "Imidacloprid 17.8% SL (against whiteflies)", dose: "0.3 ml per litre", interval: "Only if whiteflies are seen, 15 days apart" },
      { product: "Thiamethoxam 25% WG", dose: "0.3 g per litre", interval: "Alternate with the one above" },
    ],
    organic: [{ product: "Neem oil 1500 ppm", dose: "5 ml per litre, every 7 days" }],
    recovery: "Infected plants will not recover. Protecting the healthy ones is the goal.",
  },
  mites: {
    do_today: ["Check under the leaves for tiny moving dots and fine webs.", "Spray water under the leaves to knock mites off."],
    precautions: ["Mites boom in hot, dry weather. Keep plants well watered.", SAFETY],
    watering: [...BASE_WATER, "In very hot weather, water a little more often so the plant is never stressed."],
    fertilizer: [{ product: "Avoid extra urea", dose: "No extra nitrogen", when: "Soft growth attracts mites" }],
    chemical: [
      { product: "Spiromesifen 22.9% SC", dose: "1 ml per litre", interval: "Repeat after 10 days if needed" },
      { product: "Wettable sulphur 80% WP", dose: "2 g per litre", interval: "Not in heat above 32 °C" },
    ],
    organic: [{ product: "Neem oil 1500 ppm", dose: "5 ml per litre under the leaves" }],
    recovery: "New leaves should be clean in 1–2 weeks.",
  },
  mildew: {
    do_today: ["Remove the worst leaves.", "Spray the plant, covering the white patches."],
    precautions: ["Give plants space and sun.", SAFETY],
    watering: BASE_WATER,
    fertilizer: [{ product: "Potassium sulphate (SOP)", dose: "5 g per litre", when: "Every 15 days" }],
    chemical: [
      { product: "Wettable sulphur 80% WP", dose: "2 g per litre", interval: "Every 10 days" },
      { product: "Hexaconazole 5% EC", dose: "1 ml per litre", interval: "Alternate with sulphur" },
    ],
    organic: [{ product: "Potassium bicarbonate", dose: "5 g per litre" }],
    recovery: "The white coating should stop spreading within a week.",
  },
  healthy: {
    do_today: ["Nothing urgent. Keep checking the same leaves every 3–4 days."],
    precautions: ["Remove the lowest leaves that touch the soil.", "Keep the area free of weeds and fallen leaves."],
    watering: BASE_WATER,
    fertilizer: [
      { product: "Compost or farmyard manure", dose: "1–2 kg per plant", when: "At planting and once mid-season" },
      { product: "Balanced NPK 19-19-19", dose: "5 g per litre", when: "Every 15 days during flowering and fruiting" },
    ],
    chemical: [],
    organic: [{ product: "Neem oil 1500 ppm (prevention)", dose: "3 ml per litre, every 15 days" }],
    recovery: "The plant looks healthy.",
  },
  unknown: {
    do_today: ["Remove badly damaged leaves and keep them away from the plants.", "Take a clear photo of one leaf, in daylight, and scan again, or ask an expert."],
    precautions: ["Do not spray until the problem is confirmed. The wrong product costs money and can harm the crop."],
    watering: BASE_WATER,
    fertilizer: [{ product: "Balanced NPK", dose: "As your soil test advises", when: "Do not add extra to cure the problem" }],
    chemical: [],
    organic: [],
    recovery: "Scan again in 2–3 days to see whether it is spreading.",
  },
};

const LANG: Record<Group, { te: Advice; hi: Advice }> = {
  lateBlight: {
    te: { problem: "ఆకు మాడు తెగులు (లేట్ బ్లైట్)", reason: "ఆకుపై నీటితో తడిసినట్లు కనిపించే ముదురు మచ్చలు ఉన్నందున సర్కిల్ చేశాం.", steps: ["తెగులు ఆకులను తీసి కాల్చివేయండి", "యూరియా ఆపండి; 13-0-45 5 గ్రా/లీటరు పిచికారీ చేయండి", "మెటలాక్సిల్ + మాంకోజెబ్ 2.5 గ్రా/లీటరు, 7–10 రోజులకు ఒకసారి"] },
    hi: { problem: "पछेती झुलसा (लेट ब्लाइट)", reason: "पत्ती पर पानी से भीगे जैसे गहरे धब्बों के कारण घेरा लगाया गया।", steps: ["संक्रमित पत्तियाँ तोड़कर जला दें", "यूरिया बंद करें; 13-0-45 5 ग्राम/लीटर छिड़कें", "मेटालैक्सिल + मैन्कोज़ेब 2.5 ग्राम/लीटर, 7–10 दिन पर"] },
  },
  fungalSpot: {
    te: { problem: "ఆకు మచ్చ తెగులు (ఫంగస్)", reason: "ఆకుపై గోధుమ రంగు మచ్చలు, చుట్టూ పసుపు రంగు ఉన్నందున సర్కిల్ చేశాం.", steps: ["కింది మచ్చల ఆకులను తీసివేయండి", "యూరియా కొద్ది కొద్దిగా; 13-0-45 5 గ్రా/లీటరు", "మాంకోజెబ్ 2.5 గ్రా/లీటరు, 7–10 రోజులకు ఒకసారి"] },
    hi: { problem: "पत्ती धब्बा रोग (फफूंद)", reason: "पत्ती पर भूरे धब्बे और पीले घेरे के कारण घेरा लगाया गया।", steps: ["नीचे की धब्बेदार पत्तियाँ हटाएँ", "यूरिया थोड़ा-थोड़ा दें; 13-0-45 5 ग्राम/लीटर", "मैन्कोज़ेब 2.5 ग्राम/लीटर, 7–10 दिन पर"] },
  },
  leafMold: {
    te: { problem: "ఆకు బూజు తెగులు (లీఫ్ మోల్డ్)", reason: "ఆకు పైభాగంలో లేత పసుపు మచ్చలు ఉన్నందున సర్కిల్ చేశాం.", steps: ["మచ్చల ఆకులను తీసి గాలి ఆడేలా చూడండి", "యూరియా తగ్గించండి; 13-0-45 5 గ్రా/లీటరు", "క్లోరోథలోనిల్ 2 గ్రా/లీటరు ఆకు అడుగున పిచికారీ"] },
    hi: { problem: "पत्ती फफूंद (लीफ मोल्ड)", reason: "पत्ती की ऊपरी सतह पर हल्के पीले धब्बों के कारण घेरा लगाया गया।", steps: ["धब्बेदार पत्तियाँ हटाएँ और हवा आने दें", "यूरिया कम करें; 13-0-45 5 ग्राम/लीटर", "क्लोरोथालोनिल 2 ग्राम/लीटर पत्ती के नीचे छिड़कें"] },
  },
  bacterial: {
    te: { problem: "బ్యాక్టీరియా మచ్చ తెగులు", reason: "చిన్న ముదురు మచ్చలు, చుట్టూ పసుపు వలయం ఉన్నందున సర్కిల్ చేశాం.", steps: ["పొడిగా ఉన్నప్పుడు మచ్చల ఆకులను తీయండి", "ఆకులపై నీరు పోయకండి", "కాపర్ ఆక్సీక్లోరైడ్ 3 గ్రా/లీటరు, 7–10 రోజులకు ఒకసారి"] },
    hi: { problem: "जीवाणु धब्बा रोग", reason: "छोटे गहरे धब्बों और पीले घेरे के कारण घेरा लगाया गया।", steps: ["सूखे समय धब्बेदार पत्तियाँ हटाएँ", "पत्तियों पर पानी न डालें", "कॉपर ऑक्सीक्लोराइड 3 ग्राम/लीटर, 7–10 दिन पर"] },
  },
  virus: {
    te: { problem: "వైరస్ తెగులు", reason: "ఆకులు ముడుచుకోవడం, పసుపు-ఆకుపచ్చ మచ్చలు ఉన్నందున సర్కిల్ చేశాం.", steps: ["బాగా దెబ్బతిన్న మొక్కలను తీసివేయండి", "పసుపు జిగురు అట్టలు పెట్టండి", "తెల్లదోమ ఉంటే ఇమిడాక్లోప్రిడ్ 0.3 మి.లీ/లీటరు"] },
    hi: { problem: "विषाणु रोग", reason: "पत्ती मुड़ने और पीले-हरे धब्बों के कारण घेरा लगाया गया।", steps: ["अधिक प्रभावित पौधे उखाड़ दें", "पीले चिपचिपे ट्रैप लगाएँ", "सफेद मक्खी हो तो इमिडाक्लोप्रिड 0.3 मिली/लीटर"] },
  },
  mites: {
    te: { problem: "నల్లి (మైట్స్) నష్టం", reason: "ఆకుపై చిన్న పసుపు చుక్కలు ఉన్నందున సర్కిల్ చేశాం.", steps: ["ఆకు అడుగున నీరు చల్లండి", "మొక్కకు నీటి ఎద్దడి రానివ్వకండి", "వేప నూనె 5 మి.లీ/లీటరు లేదా స్పైరోమెసిఫెన్ 1 మి.లీ/లీటరు"] },
    hi: { problem: "मकड़ी (माइट) नुकसान", reason: "पत्ती पर छोटे पीले बिंदुओं के कारण घेरा लगाया गया।", steps: ["पत्ती के नीचे पानी छिड़कें", "पौधे को पानी की कमी न होने दें", "नीम तेल 5 मिली/लीटर या स्पाइरोमेसिफेन 1 मिली/लीटर"] },
  },
  mildew: {
    te: { problem: "బూడిద తెగులు", reason: "ఆకుపై తెల్లటి పొడి ఉన్నందున సర్కిల్ చేశాం.", steps: ["ఎక్కువగా దెబ్బతిన్న ఆకులను తీయండి", "SOP 5 గ్రా/లీటరు", "గంధకం 2 గ్రా/లీటరు, 10 రోజులకు ఒకసారి"] },
    hi: { problem: "चूर्णिल आसिता (पाउडरी मिल्ड्यू)", reason: "पत्ती पर सफेद पाउडर के कारण घेरा लगाया गया।", steps: ["अधिक प्रभावित पत्तियाँ हटाएँ", "SOP 5 ग्राम/लीटर", "घुलनशील गंधक 2 ग्राम/लीटर, 10 दिन पर"] },
  },
  healthy: {
    te: { problem: "ఆరోగ్యంగా ఉంది", reason: "ఆకుపై మచ్చలు కనిపించలేదు.", steps: ["3–4 రోజులకు ఒకసారి అదే ఆకులను చూడండి", "ఉదయం మొదట్లో మొక్క మొదట్లో నీరు పోయండి", "19-19-19 5 గ్రా/లీటరు, 15 రోజులకు ఒకసారి"] },
    hi: { problem: "स्वस्थ", reason: "पत्ती पर कोई धब्बा नहीं दिखा।", steps: ["हर 3–4 दिन उन्हीं पत्तियों को देखें", "सुबह जड़ के पास पानी दें", "19-19-19 5 ग्राम/लीटर, 15 दिन पर"] },
  },
  unknown: {
    te: { problem: "సమస్య స్పష్టంగా తెలియలేదు", reason: "ఫోటో నుండి ఖచ్చితంగా చెప్పలేకపోయాం.", steps: ["ఒక ఆకు స్పష్టమైన ఫోటో పగటి వెలుతురులో తీయండి", "నిర్ధారణ అయ్యేవరకు మందులు పిచికారీ చేయకండి", "కిసాన్ కాల్ సెంటర్ 1800-180-1551 కి కాల్ చేయండి"] },
    hi: { problem: "समस्या स्पष्ट नहीं", reason: "फोटो से पक्का नहीं कह सकते।", steps: ["दिन की रोशनी में एक पत्ती की साफ फोटो लें", "पक्का होने तक दवा न छिड़कें", "किसान कॉल सेंटर 1800-180-1551 पर कॉल करें"] },
  },
};

function groupOf(name: string | undefined): Group {
  if (!name) return "unknown";
  const n = name.toLowerCase();
  if (n.endsWith("healthy")) return "healthy";
  if (n.includes("late blight")) return "lateBlight";
  if (n.includes("leaf mold")) return "leafMold";
  if (n.includes("bacterial")) return "bacterial";
  if (n.includes("virus")) return "virus";
  if (n.includes("mite")) return "mites";
  if (n.includes("mildew")) return "mildew";
  if (/blight|spot|rust|scab|rot/.test(n)) return "fungalSpot";
  return "unknown";
}

const NOT_A_LEAF: Record<"flower" | "not_plant", { en: string; te: string; hi: string }> = {
  flower: {
    en: "This looks like a flower, not a tomato leaf. Patra Lens checks leaves. Take a photo of one leaf.",
    te: "ఇది పువ్వులా ఉంది, టమోటా ఆకు కాదు. ఒక ఆకు ఫోటో తీయండి.",
    hi: "यह फूल जैसा दिखता है, टमाटर की पत्ती नहीं। एक पत्ती की फोटो लें।",
  },
  not_plant: {
    en: "We could not find a plant leaf in this photo. Take a photo of one leaf that fills most of the frame.",
    te: "ఈ ఫోటోలో మొక్క ఆకు కనిపించలేదు. ఫ్రేమ్ నిండేలా ఒక ఆకు ఫోటో తీయండి.",
    hi: "इस फोटो में पौधे की पत्ती नहीं मिली। फ्रेम भरती हुई एक पत्ती की फोटो लें।",
  },
};

const EMPTY_CARE: Care = { do_today: [], precautions: [], watering: [], fertilizer: [], chemical: [], organic: [], recovery: "" };

/** Builds the same answer shape as the AI, from the on-device model and the colour masks. */
/** General care, for crops the phone model does not know (paddy, chilli): no disease-specific sprays. */
export const GENERAL_CARE: Care = CARE.unknown;

export function localResult(d: Diagnosis, kind: PhotoKind, detections: Detection[]): LeafResult {
  if (kind !== "leaf") {
    const msg = NOT_A_LEAF[kind];
    const ask = (text: string): Advice => ({ problem: text.split(".")[0], reason: text, steps: [] });
    return {
      subject: kind, is_plant: kind === "flower", plant: "Unknown", is_tomato: false, plant_note: msg.en, healthy: false,
      disease: { name: kind === "flower" ? "Not a leaf" : "No leaf found", latin: "", kind: "unknown", severity: "None", confidence: 0, symptoms_seen: [], cause: "", look_alikes: "", confirm_by: "" },
      detections: [], care: EMPTY_CARE, languages: { en: ask(msg.en), te: ask(msg.te), hi: ask(msg.hi) },
    };
  }
  const top = d.prediction.top3[0];
  const sure = d.level === "CLEAR";
  // When the model is not fully sure, still give the plan for its most likely answer, clearly marked "likely",
  // instead of generic advice: a farmer needs to know what to do today.
  const group = groupOf(top?.name);
  const plant = plantOf(top) ?? "Unknown";
  const healthy = group === "healthy" && sure;
  const name = top ? top.name.replace(/^[^:]+: /, "") : "Unknown";
  const base = CARE[healthy || group !== "healthy" ? group : "unknown"];
  const confirm = sure ? [] : [`The AI is ${Math.round((top?.p ?? 0) * 100)}% sure this is ${name}. Check the signs below before spraying, or send the scan to a lab.`];
  const care: Care = { ...base, precautions: [...confirm, ...base.precautions], fertilizer: [...cropFeed(plant), ...base.fertilizer] };
  // Severity from how much of the photo the marked areas cover (0-1000 boxes), not just how many there are.
  const coverPct = detections.reduce((a, b) => a + (b.xmax - b.xmin) * (b.ymax - b.ymin), 0) / 10_000;
  const severity = healthy ? "None" : coverPct > 15 || detections.length > 15 ? "Severe" : coverPct > 5 || detections.length > 5 ? "Moderate" : "Mild";
  const shown = sure ? name : `Likely ${name}`;
  return {
    subject: "leaf",
    is_plant: true,
    plant,
    is_tomato: plant === "Tomato",
    plant_note: plant === "Tomato" ? "The on-device model reads this as a tomato leaf." : plant === "Unknown" ? "The on-device model could not tell which plant this is." : `The on-device model reads this as a ${plant} leaf, not tomato.`,
    healthy,
    disease: {
      name: healthy ? "Healthy" : sure ? name : `Likely ${name} (not fully sure)`, latin: "", kind: "unknown",
      severity, confidence: top?.p ?? 0, symptoms_seen: [], cause: "", look_alikes: d.prediction.top3[1]?.name ?? "", confirm_by: "",
    },
    detections: healthy ? [] : detections,
    care,
    languages: {
      en: {
        problem: healthy ? "Healthy leaf" : shown,
        reason: healthy ? "No spots were found." : `${detections.length} affected areas are circled: red for spots, yellow for dried tissue.`,
        steps: [...care.do_today, ...care.fertilizer.slice(0, 2).map((f) => `${f.product}: ${f.dose} (${f.when})`), ...care.chemical.slice(0, 1).map((c) => `${c.product}: ${c.dose}, ${c.interval}`)],
      },
      ...LANG[healthy || group !== "healthy" ? group : "unknown"],
    },
  };
}

/** The season's main fertilizer for one acre of this crop (state guide doses, medium soil), first in the plan. */
function cropFeed(plant: string): Care["fertilizer"] {
  const crop = plant === "Corn" ? "Maize" : plant;
  if (!RDF.some((r) => r.crop === crop)) return [];
  const r = calculate({ crop, acres: 1, soil: { n: "medium", p: "medium", k: "medium" }, organic: false });
  const [dap, urea, mop] = r.products;
  return [{
    product: `Main feed for 1 acre of ${crop.toLowerCase()} (whole season)`,
    dose: `DAP ${dap.kg} kg + Urea ${urea.kg} kg + Potash (MOP) ${mop.kg} kg`,
    when: r.rdf.splits,
  }];
}
