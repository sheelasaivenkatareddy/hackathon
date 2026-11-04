// Expert Labs & RBK Connect directory.
// Only the two national helplines carry phone numbers. Office numbers change often, so entries without a verified
// `phone` call the Kisan Call Centre instead, which connects to the local officer. Add a verified number here to
// switch an entry to a direct call.
import type { StateId } from "./store";

export type DirType = "Helpline" | "ICAR" | "University" | "Lab" | "KVK" | "RBK" | "RSK" | "Officer";
export interface DirEntry {
  id: string; type: DirType; name: string; state: StateId | "IN"; district: string; place: string;
  services: string[]; crops?: string[]; phone?: string; whatsapp?: string; website?: string;
  hours?: string; verified: boolean; acceptsScans: boolean;
}

export const KCC_TEL = "18001801551";

export const DIRECTORY: DirEntry[] = [
  // National helplines (verified)
  { id: "kcc", type: "Helpline", name: "Kisan Call Centre", state: "IN", district: "All India", place: "Ministry of Agriculture & Farmers Welfare", services: ["Free crop advice in 22 languages", "Connects to state experts"], phone: "1800-180-1551", hours: "6 AM to 10 PM, every day", website: "https://mkisan.gov.in/", verified: true, acceptsScans: false },
  { id: "pmfby", type: "Helpline", name: "PMFBY Crop Insurance Helpline", state: "IN", district: "All India", place: "Krishi Rakshak portal & helpline", services: ["Crop loss intimation", "Claim status", "Enrolment help"], phone: "14447", website: "https://pmfby.gov.in/", verified: true, acceptsScans: false },

  // ICAR institutes and universities
  { id: "iihr", type: "ICAR", name: "ICAR–Indian Institute of Horticultural Research (IIHR)", state: "KA", district: "Bengaluru", place: "Hesaraghatta Lake Post, Bengaluru", services: ["Tomato & vegetable disease diagnosis", "Arka varieties & bio-inputs", "Plant pathology"], crops: ["Tomato", "Chilli", "Onion"], website: "https://iihr.res.in/", verified: false, acceptsScans: true },
  { id: "iirr", type: "ICAR", name: "ICAR–Indian Institute of Rice Research (IIRR)", state: "TS", district: "Rangareddy (Hyderabad)", place: "Rajendranagar, Hyderabad", services: ["Paddy disease & pest diagnosis", "Blast, BLB, sheath blight advice"], crops: ["Paddy"], website: "https://www.icar-iirr.org/", verified: false, acceptsScans: true },
  { id: "nbair", type: "ICAR", name: "ICAR–National Bureau of Agricultural Insect Resources (NBAIR)", state: "KA", district: "Bengaluru", place: "Hebbal, Bengaluru", services: ["Insect pest identification", "Biocontrol agents"], website: "https://www.nbair.res.in/", verified: false, acceptsScans: true },
  { id: "angrau", type: "University", name: "Acharya N.G. Ranga Agricultural University (ANGRAU)", state: "AP", district: "Guntur", place: "Lam, Guntur", services: ["Plant pathology lab", "Chilli, cotton & paddy advisories", "Soil testing"], crops: ["Dry Chilli", "Cotton", "Paddy"], website: "https://angrau.ac.in/", verified: false, acceptsScans: true },
  { id: "pjtau", type: "University", name: "Professor Jayashankar Telangana Agricultural University", state: "TS", district: "Rangareddy (Hyderabad)", place: "Rajendranagar, Hyderabad", services: ["Plant clinic", "Crop advisories", "Soil & water testing"], crops: ["Paddy", "Cotton", "Maize"], verified: false, acceptsScans: true },
  { id: "uasb", type: "University", name: "University of Agricultural Sciences, Bangalore (GKVK)", state: "KA", district: "Bengaluru Rural", place: "GKVK campus, Bengaluru", services: ["Plant health clinic", "Soil testing", "Ragi, paddy & vegetable advice"], website: "https://www.uasbangalore.edu.in/", verified: false, acceptsScans: true },

  // Labs and KVKs (sample listings; every district has a KVK and a soil testing lab)
  { id: "soil-gnt", type: "Lab", name: "District Soil Testing Laboratory", state: "AP", district: "Guntur", place: "Guntur", services: ["Soil Health Card", "NPK, pH & micronutrient test"], verified: false, acceptsScans: false },
  { id: "kvk-knl", type: "KVK", name: "Krishi Vigyan Kendra, Kurnool", state: "AP", district: "Kurnool", place: "Kurnool district", services: ["Field visits", "Disease diagnosis", "Training"], verified: false, acceptsScans: true },
  { id: "kvk-wgl", type: "KVK", name: "Krishi Vigyan Kendra, Warangal", state: "TS", district: "Warangal", place: "Warangal district", services: ["Cotton & chilli advisories", "Field visits"], verified: false, acceptsScans: true },
  { id: "soil-kmm", type: "Lab", name: "District Soil Testing Laboratory", state: "TS", district: "Khammam", place: "Khammam", services: ["Soil Health Card", "NPK & pH test"], verified: false, acceptsScans: false },
  { id: "kvk-klr", type: "KVK", name: "Krishi Vigyan Kendra, Kolar", state: "KA", district: "Kolar", place: "Kolar district", services: ["Tomato disease clinic", "Field visits"], crops: ["Tomato"], verified: false, acceptsScans: true },

  // Village service centres
  { id: "rsk-mdp", type: "RBK", name: "Rythu Seva Kendram (RBK), Madanapalle", state: "AP", district: "Annamayya (Madanapalle)", place: "Madanapalle mandal", services: ["Seeds & fertilizer booking", "e-Crop registration", "Village Agri Assistant"], crops: ["Tomato"], verified: false, acceptsScans: true },
  { id: "rsk-gnt", type: "RBK", name: "Rythu Seva Kendram (RBK), Guntur rural", state: "AP", district: "Guntur", place: "Guntur rural mandal", services: ["Inputs booking", "Crop insurance enrolment", "Soil sample collection"], verified: false, acceptsScans: true },
  { id: "rsk-atp", type: "RBK", name: "Rythu Seva Kendram (RBK), Anantapur", state: "AP", district: "Anantapur", place: "Anantapur rural mandal", services: ["Groundnut advisories", "Inputs booking"], crops: ["Groundnut"], verified: false, acceptsScans: true },
  { id: "rv-sry", type: "RBK", name: "Rythu Vedika, Suryapet", state: "TS", district: "Suryapet", place: "Suryapet cluster", services: ["AEO meetings", "Paddy procurement info", "Rythu Bharosa help"], crops: ["Paddy"], verified: false, acceptsScans: true },
  { id: "rv-nzb", type: "RBK", name: "Rythu Vedika, Nizamabad", state: "TS", district: "Nizamabad", place: "Nizamabad cluster", services: ["Turmeric & paddy advice", "Scheme enrolment"], verified: false, acceptsScans: true },
  { id: "rsk-klr", type: "RSK", name: "Raitha Samparka Kendra, Kolar", state: "KA", district: "Kolar", place: "Kolar hobli", services: ["Subsidised inputs", "FRUITS registration", "Crop insurance"], crops: ["Tomato"], verified: false, acceptsScans: true },
  { id: "rsk-hvr", type: "RSK", name: "Raitha Samparka Kendra, Byadgi", state: "KA", district: "Haveri (Byadgi)", place: "Byadgi hobli", services: ["Chilli advisories", "Subsidised inputs"], crops: ["Dry Chilli"], verified: false, acceptsScans: true },
  { id: "rsk-rcr", type: "RSK", name: "Raitha Samparka Kendra, Raichur", state: "KA", district: "Raichur", place: "Raichur hobli", services: ["Paddy & cotton inputs", "Machinery hire"], verified: false, acceptsScans: true },

  // Officers (by post, not by name)
  { id: "mao-gnt", type: "Officer", name: "Mandal Agricultural Officer (MAO)", state: "AP", district: "Guntur", place: "Guntur", services: ["Pest outbreak reporting", "Input subsidy approvals"], verified: false, acceptsScans: true },
  { id: "aeo-wgl", type: "Officer", name: "Agricultural Extension Officer (AEO)", state: "TS", district: "Warangal", place: "Warangal cluster", services: ["Crop loss assessment", "Rythu Bharosa verification"], verified: false, acceptsScans: true },
  { id: "ada-klr", type: "Officer", name: "Assistant Director of Agriculture", state: "KA", district: "Kolar", place: "Kolar taluk", services: ["Disease outbreak response", "Scheme approvals"], verified: false, acceptsScans: true },
];

export const TYPE_LABEL: Record<DirType, string> = {
  Helpline: "Helpline", ICAR: "ICAR institute", University: "Agri university", Lab: "Testing lab", KVK: "KVK",
  RBK: "RBK / Rythu Vedika", RSK: "Raitha Samparka Kendra", Officer: "Agri officer",
};

export const telOf = (e: DirEntry) => (e.phone ?? "").replace(/\D/g, "") || KCC_TEL;
