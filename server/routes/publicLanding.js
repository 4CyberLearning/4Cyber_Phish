// server/routes/publicLanding.js
import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

// stejný default tenant jako jinde
const DEFAULT_TENANT_SLUG = "demo";

async function getTenantId() {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: DEFAULT_TENANT_SLUG,
        name: "Demo tenant",
      },
    });
  }

  return tenant.id;
}

function wrapHtml(name, html = "") {
  const trimmed = html.trim();
  // pokud už je to celé HTML, jen ho odešleme
  if (/<!doctype html>|<html[^>]*>/i.test(trimmed)) {
    return trimmed;
  }

  const safeTitle = String(name || "Phishing training").replace(/[<>]/g, "");

  return `<!doctype html>
  <html lang="cs">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safeTitle}</title>
    </head>
    <body>
  ${trimmed}
    </body>
  </html>`;
}

function rewriteUploadsToSameOrigin(html = "") {
  return String(html)
    // přepis libovolné absolutní URL na /uploads/... pokud vede na /uploads/
    .replace(/https?:\/\/[^/"']+\/uploads\//gi, "/uploads/");
}

function escapeAttr(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectLandingScripts(html, { token, slug }) {
  const t = String(token || "").trim();
  const safeSlug = escapeAttr(String(slug || ""));

  // HARDENING: <form> bez method / method="get" -> přepnout na POST
  html = html
    .replace(
      /<form([^>]*?)\bmethod\s*=\s*(["']?)\s*get\s*\2([^>]*)>/gi,
      '<form$1 method="post"$3>'
    )
    .replace(
      /<form(?![^>]*\bmethod\s*=)([^>]*)>/gi,
      '<form method="post"$1>'
    );

  const scripts = [];

  // tracking skript jen pokud máme token
  if (t) {
    const safeToken = escapeAttr(t);
    scripts.push(
      `<script src="/js/landing-tracking.js" defer data-token="${safeToken}" data-page="${safeSlug}"></script>`
    );
  }

  // UI skript vždy – aby fungovalo přepínání kroků i v náhledu bez tokenu
  scripts.push(`<script src="/js/landing-ui.js" defer></script>`);

  const scriptTag = scripts.join("\n");

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${scriptTag}</body>`);
  }
  return `${html}\n${scriptTag}`;
}

// GET /lp/:slug – veřejná landing page pro uživatele
router.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).send("Missing slug");
    }

    const tenantId = await getTenantId();

    const page = await prisma.landingPage.findFirst({
      where: { tenantId, urlSlug: slug },
    });

    if (!page) {
      return res.status(404).send("Landing page not found");
    }

    const token = String(req.query.t || req.query.token || "").trim();
    let html = rewriteUploadsToSameOrigin(page.html || "");
    html = wrapHtml(page.name, html);
    html = injectLandingScripts(html, { token, slug });

    res.type("html").send(html);
  } catch (err) {
    console.error("GET /lp/:slug error", err);
    res.status(500).send("Internal server error");
  }
});

export default router;
