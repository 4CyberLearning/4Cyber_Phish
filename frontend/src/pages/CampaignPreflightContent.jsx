// =========================
// UPRAVITELNÝ OBSAH STRÁNKY
// (edituj title/lead/note + checklist níže)
// =========================

export const PREFLIGHT_TITLE = "Příprava před odesláním";

export const PREFLIGHT_LEAD =
  "Tahle stránka slouží jako rychlá kontrola, že je vše připravené na straně zadavatele i klienta. Položky si můžeš postupně odfajfkovat.";

export const PREFLIGHT_NOTE =
  "Tip: pokud některé položky ve vašem procesu nedávají smysl, klidně je smaž nebo přejmenuj přímo v tomto souboru.";

export const PREFLIGHT_ITEMS = [
  {
    id: "client_whitelist_domain",
    owner: "Klient",
    title: "Whitelist odesílací domény",
    description:
      "Použitá doména (From / Return-Path / tracking) je povolena v mail gateway / antispam řešení.",
  },
  {
    id: "client_allow_static_ips",
    owner: "Klient",
    title: "Allowlist statických IP adres",
    description:
      "Jsou domluvené a povolené statické IP adresy, odkud budou e-maily odesílány.",
  },
  {
    id: "client_spf_dkim_dmarc",
    owner: "Zadavatel",
    title: "SPF / DKIM / DMARC ověřeno",
    description:
      "Nastavení autentizace odpovídá použité doméně a odesílacímu řešení (testované na vzorku e-mailu).",
  },
  {
    id: "client_url_scanner",
    owner: "Klient",
    title: "Kontrola URL scanningu / safe-links",
    description:
      "Je domluvené chování URL skenerů (např. SafeLinks) tak, aby nezkreslovaly tracking a neblokovaly landing page.",
  },
  {
    id: "client_landing_access",
    owner: "Zadavatel",
    title: "Landing page dostupná z cílové sítě",
    description:
      "Landing page je dostupná z prostředí cílových uživatelů (bez blokace DNS/proxy/SSL inspection).",
  },
  {
    id: "requester_content_approved",
    owner: "Zadavatel",
    title: "Obsah schválen",
    description:
      "E-mail i landing page jsou finálně schválené (texty, loga, CTA, jazyk, scénář).",
  },
  {
    id: "requester_sender_identity",
    owner: "Zadavatel",
    title: "Odesílatel schválen",
    description:
      "Je potvrzený přesný From / Reply-To a chování odesílatele (jméno, adresa, doména).",
  },
  {
    id: "requester_targets_verified",
    owner: "Zadavatel",
    title: "Příjemci ověřeni",
    description:
      "Cílový seznam je finální (skupiny/uživatelé), bez testovacích nebo nechtěných adres.",
  },
  {
    id: "joint_test_send",
    owner: "Společně",
    title: "Testovací odeslání",
    description:
      "Proběhlo testovací odeslání na kontrolní mailbox a je ověřené zobrazení + hlavičky.",
  },
  {
    id: "joint_support_contacts",
    owner: "Společně",
    title: "Kontaktní osoby a postup",
    description:
      "Je dohodnutý postup pro případ dotazů/incidentu a kontakty (SOC/Helpdesk/PM).",
  },
];
