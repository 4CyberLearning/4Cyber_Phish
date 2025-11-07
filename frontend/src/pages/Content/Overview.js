import { Link } from "react-router-dom";

const tiles = [
  { to: "/content/email-templates", title: "E-mailové šablony", desc: "HTML/text, proměnné, náhledy." },
  { to: "/content/landing-pages",   title: "Landing pages",     desc: "Formuláře, validace, redirecty." },
  { to: "/content/snippets",        title: "Snippety bloků",    desc: "Hlavičky, patičky, CTA." },
  { to: "/content/assets",          title: "Assety / soubory",  desc: "Obrázky, přílohy, loga." },
  { to: "/content/sender-identities", title: "Odesílací identity", desc: "Výběr z připravených domén/adres." },
];

export default function ContentOverview() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Obsah</h1>
        <p className="text-gray-600">Správa e-mailů, landing pages a znovupoužitelných bloků.</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="card p-5 transition-transform hover:-translate-y-0.5">
            <div className="text-base font-semibold text-gray-900">{t.title}</div>
            <div className="mt-1 text-sm text-gray-600">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
