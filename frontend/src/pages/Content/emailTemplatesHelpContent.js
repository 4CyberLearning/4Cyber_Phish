export const EMAIL_TEMPLATES_HELP = {
  intro:
    "Tato nápověda vysvětluje proměnné, doporučenou strukturu HTML a zásady, aby fungovalo měření (open/click) v kampaních.",
  variables: [
    { key: "{{name}}", desc: "Jméno příjemce (personalizace obsahu)." },
    { key: "{{email}}", desc: "E-mail příjemce (např. pro patičku / kontrolu)." },
    {
      key: "{{link}}",
      desc:
        "Hlavní CTA odkaz na landing page. Doporučeno použít alespoň jednou (typicky na tlačítku).",
    },
  ],
  tracking: [
    "Open tracking: systém při odeslání kampaně přidává tracking pixel automaticky (nemusíš vkládat ručně).",
    "Click tracking: systém přepisuje odkazy v HTML na trackované URL (vyjímky: mailto:, javascript:, #).",
    "Doporučení: hlavní tlačítko vždy odkazuj na {{link}} (získáš jednotné měření kliků a správné směrování).",
  ],
  htmlRules: [
    "Používej inline styly (email klienti často ignorují moderní CSS).",
    "U obrázků používej absolutní URL (z Assetů) a styl: display:block; width:100%; height:auto; border:0;",
    "Nepoužívej externí JS. Formuláře a skripty v e-mailu nefungují spolehlivě.",
  ],
  example: `<p>Dobrý den, {{name}},</p>
<p>V rámci bezpečnostní kontroly prosím ověřte svůj účet:</p>
<p style="margin:16px 0;">
  <a href="{{link}}" style="background:#0597D9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;display:inline-block;font-weight:700;">
    Ověřit účet
  </a>
</p>
<p style="font-size:12px;color:#6b7280;">
  Tento e-mail je určen pouze pro {{email}}.
</p>`,
  note:
    "Pozn.: Testovací odeslání může mít omezené měření; finální tracking/statistiky se řeší při odeslání kampaně.",
};
