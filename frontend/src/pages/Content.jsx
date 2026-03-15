import { useTranslation } from "react-i18next";

export default function ContentPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">{t("nav.content.title") || "Obsah"}</h1>
      <p className="text-gray-600">
        Knihovna e-mailových šablon, landing pages, identit odesílatelů, assetů a nově i schválených balíčků.
      </p>
    </div>
  );
}
