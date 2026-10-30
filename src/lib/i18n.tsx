// Language: en / te / kn. Falls back to English for anything a translation does not have.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "../i18n/en.json";
import kn from "../i18n/kn.json";
import te from "../i18n/te.json";
import { getSetting, setSetting } from "./db";

export type Lang = "en" | "te" | "kn";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "te", label: "తెలుగు" },
  { id: "kn", label: "ಕನ್ನಡ" },
];
const STRINGS: Record<Lang, Record<string, string>> = { en, te, kn };

type Vars = Record<string, string | number>;
interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Vars) => string;
  disease: (name: string) => string;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
}
const Ctx = createContext<I18n>(null as unknown as I18n);
export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => { getSetting<Lang>("lang", "en").then(setLangState); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => { setLangState(l); setSetting("lang", l); }, []);
  const t = useCallback((key: string, vars?: Vars) => {
    let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  }, [lang]);
  // Plants other than tomato have no translated names yet, so they stay in English.
  const disease = useCallback((name: string) => { const s = t(`disease.${name}`); return s === `disease.${name}` ? name : s; }, [t]);

  const value = useMemo(() => ({ lang, setLang, t, disease, sheetOpen, setSheetOpen }), [lang, setLang, t, disease, sheetOpen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
