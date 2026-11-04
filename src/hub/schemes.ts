// Quick eligibility guide for central and state farmer schemes. A guide, not a decision: amounts and rules change,
// so every card links to the official portal and says where to confirm.
import type { StateId } from "./store";

export interface Answers {
  state: StateId; land: "owner" | "tenant" | "none"; acres: number;
  taxpayer: boolean; govtEmployee: boolean; bankAadhaar: boolean; growsNotifiedCrop: boolean;
}

export interface Scheme {
  id: string; name: string; who: "Central" | StateId; benefit: string; apply: string; link?: string;
  check: (a: Answers) => { ok: boolean | "maybe"; why: string };
}

export const SCHEMES: Scheme[] = [
  {
    id: "pmkisan", name: "PM-KISAN", who: "Central",
    benefit: "₹6,000 a year, paid in 3 instalments of ₹2,000 straight to the bank account.",
    apply: "Register at pmkisan.gov.in, a Common Service Centre or your RBK/RSK. e-KYC is required.",
    link: "https://pmkisan.gov.in/",
    check: (a) => a.land !== "owner" ? { ok: false, why: "Only for families who own farm land in their name." }
      : a.taxpayer || a.govtEmployee ? { ok: false, why: "Income-tax payers and government employees are excluded." }
      : !a.bankAadhaar ? { ok: "maybe", why: "Eligible, but link Aadhaar to your bank account first." }
      : { ok: true, why: "You own land and are not in an excluded group." },
  },
  {
    id: "pmfby", name: "PMFBY crop insurance", who: "Central",
    benefit: "Insurance against crop loss from drought, flood, pests and disease. Farmer pays only 2% of the sum insured for kharif, 1.5% for rabi and 5% for commercial or horticulture crops.",
    apply: "Enrol through your bank, CSC, RBK/RSK or the PMFBY portal/app before the season cut-off. Helpline 14447.",
    link: "https://pmfby.gov.in/",
    check: (a) => !a.growsNotifiedCrop ? { ok: "maybe", why: "Open to owners and tenants, but only for crops notified in your area. Ask your RBK/RSK." }
      : a.land === "none" ? { ok: "maybe", why: "You must be cultivating the land, as an owner, tenant or sharecropper." }
      : { ok: true, why: "Owners and tenant farmers growing a notified crop can enrol." },
  },
  {
    id: "kcc", name: "Kisan Credit Card (KCC)", who: "Central",
    benefit: "Short-term crop loan at 7% interest. Repay on time and get 3% back, so the effective rate is 4%.",
    apply: "Apply at any bank branch with land or tenancy papers, Aadhaar and a photo.",
    check: (a) => a.land === "none" ? { ok: "maybe", why: "Tenants and oral lessees can apply through a joint liability group." }
      : { ok: true, why: "Owners and tenant farmers can apply." },
  },
  {
    id: "shc", name: "Soil Health Card", who: "Central",
    benefit: "Free soil test with crop-wise fertilizer advice. Use it in the NPK calculator here.",
    apply: "Give a soil sample at your RBK/RSK or the district soil testing lab.",
    link: "https://soilhealth.dac.gov.in/",
    check: (a) => a.land === "none" ? { ok: "maybe", why: "For anyone cultivating land." } : { ok: true, why: "Free for every farmer." },
  },
  {
    id: "ap-annadata", name: "Annadata Sukhibhava (earlier YSR Rythu Bharosa)", who: "AP",
    benefit: "Andhra Pradesh investment support, given together with PM-KISAN (₹20,000 a year in total, announced 2025). Check the current amount at your RSK.",
    apply: "Your Rythu Seva Kendram (RBK) checks e-Crop and land records. Keep Aadhaar and bank details updated.",
    check: (a) => a.state !== "AP" ? { ok: false, why: "Only for Andhra Pradesh." }
      : a.taxpayer || a.govtEmployee ? { ok: false, why: "Income-tax payers and government employees are usually excluded." }
      : a.land === "owner" ? { ok: true, why: "Land-owning farmers in AP." }
      : a.land === "tenant" ? { ok: "maybe", why: "Tenant farmers with a CCRC card may qualify. Ask at your RSK." }
      : { ok: false, why: "You need to own or lease farm land." },
  },
  {
    id: "ts-rythubharosa", name: "Rythu Bharosa (Telangana)", who: "TS",
    benefit: "Telangana investment support per acre of cultivable land, paid each season (₹12,000 an acre a year, announced 2025).",
    apply: "Paid to pattadars from land records. Check your name with the AEO at your Rythu Vedika.",
    check: (a) => a.state !== "TS" ? { ok: false, why: "Only for Telangana." }
      : a.land === "owner" ? { ok: true, why: `About ₹${(12000 * a.acres).toLocaleString("en-IN")} a year for ${a.acres} acre(s), if all of it is cultivable.` }
      : { ok: false, why: "Paid to land owners (pattadars). Landless farm workers can ask about Indiramma Atmiya Bharosa." },
  },
  {
    id: "ka-krishibhagya", name: "Krishi Bhagya (Karnataka)", who: "KA",
    benefit: "Subsidy for farm ponds, pumps and micro-irrigation for rain-fed farms.",
    apply: "Apply at your Raitha Samparka Kendra (RSK) with land records. Your FRUITS ID is needed.",
    check: (a) => a.state !== "KA" ? { ok: false, why: "Only for Karnataka." }
      : a.land === "owner" ? { ok: "maybe", why: "For rain-fed land owners in the notified taluks. Confirm at the RSK." }
      : { ok: false, why: "You need to own the land." },
  },
  {
    id: "kusum", name: "PM-KUSUM solar pump", who: "Central",
    benefit: "Solar pump with central and state subsidy. The farmer pays a smaller share.",
    apply: "Apply on your state's renewable energy portal or through the agriculture department.",
    link: "https://pmkusum.mnre.gov.in/",
    check: (a) => a.land === "owner" ? { ok: "maybe", why: "For land owners. Quotas and the farmer's share differ by state." } : { ok: false, why: "You need to own the land." },
  },
];
