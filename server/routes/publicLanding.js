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

    const html = wrapHtml(page.name, page.html);
    res.type("html").send(html);
  } catch (err) {
    console.error("GET /lp/:slug error", err);
    res.status(500).send("Internal server error");
  }
});

export default router;
