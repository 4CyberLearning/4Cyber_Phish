import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "../locales/cs/translation.json";
import en from "../locales/en/translation.json";

i18n
  .use(initReactI18next)
  .init({
    resources: { cs: { translation: cs }, en: { translation: en } },
    lng: "cs",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnObjects: true,
  });

export default i18n;
