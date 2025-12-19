// src/navigation.js
export const nav = [
  // --- single (bez podmenu) ---
  {
    key: "nav.dashboard",
    iconName: "dashboard",  // <- musí sedět na název PNG souboru
    to: "/dashboard"
  },
  // --- single (bez podmenu) ---
  {
    key: "nav.playbook.title",
    iconName: "playbook",
    to: "/playbook"
  },
  // --- skupiny s podmenu ---
  {
    key: "nav.content.title",     // label nadpisu "Obsah"
    iconName: "content",
    overview: "/content",
    children: [
      {
        key: "nav.content.emailTemplates",    // E-mailové šablony
        to: "/content/email-templates",
      },
      {
        key: "nav.content.landingPages",      // Landing pages
        to: "/content/landing-pages",
      },
      {
        key: "nav.content.senderIdentities",  // Odesílací identity
        to: "/content/sender-identities",
      },
      {
        key: "nav.content.assets",            // Assety / soubory
        to: "/content/assets",
      },
    ],
  },
  {
    key: "nav.campaign.title",
    iconName: "campaign",
    overview: "/campaigns",
    children: [
      { key: "nav.campaign.new",        to: "/campaigns/new" },
      { key: "nav.campaign.list",       to: "/campaigns/list" },
      { key: "nav.campaign.aftercare",  to: "/campaigns/aftercare" },
    ],
  },
  {
    key: "nav.recipients.title",
    iconName: "users",
    overview: "/recipients",
    children: [
      { key: "nav.recipients.upload", to: "/users", },
      { key: "nav.recipients.groups", to: "/users", },
      { key: "nav.recipients.rules",  to: "/users", },
    ],
  },
  {
    key: "nav.reports.title",
    iconName: "report",
    overview: "/reports",
    children: [
      { key: "nav.reports.overview", to: "/reports/overview" },
      { key: "nav.reports.delivery", to: "/reports/delivery" },
      { key: "nav.reports.security", to: "/reports/security" },
      { key: "nav.reports.audit",    to: "/reports/audit" },
    ],
  },
  {
    key: "nav.automation.title",
    iconName: "automation",
    overview: "/automation",
    children: [
      { key: "nav.automation.rules",  to: "/automation/rules" },
      { key: "nav.automation.tasks",  to: "/automation/tasks" },
    ],
  },
  {
    key: "nav.settings.title",
    iconName: "settings",
    overview: "/settings",
    children: [
      { key: "nav.settings.general", to: "/settings/general" },
      { key: "nav.settings.mail",    to: "/settings/mail" },
      { key: "nav.settings.api",     to: "/settings/api-keys" },
      { key: "nav.settings.users",   to: "/settings/users" },
    ],
  },
];
