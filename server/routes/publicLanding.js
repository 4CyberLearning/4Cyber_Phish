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

function injectLandingTracking(html, { token, slug }) {
  const t = String(token || "").trim();
  if (!t) return html;

  const safeSlug = String(slug || "").replace(/["<>]/g, "");
  const safeToken = t.replace(/["<>]/g, "");

  // HARDENING: <form> bez method (nebo method="get") -> prohlížeč pošle GET a hodnoty skončí v URL (logy/historie).
  // Přepneme všechny formuláře na POST (fallback i pro případ, že JS selže).
  html = html
    .replace(
      /<form([^>]*?)\bmethod\s*=\s*(["']?)\s*get\s*\2([^>]*)>/gi,
      '<form$1 method="post"$3>'
    )
    .replace(
      /<form(?![^>]*\bmethod\s*=)([^>]*)>/gi,
      '<form method="post"$1>'
    );


  const script = `
<script>
(function(){
  var TOKEN = "${safeToken}";
  var PAGE = "${safeSlug}";

  function send(meta){
    try {
      var payload = JSON.stringify(meta);
      var url = "/t/s/" + encodeURIComponent(TOKEN);
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function(){});
    } catch(e){}
  }

  document.addEventListener("submit", function(ev){
    var form = ev.target;
    if (!form || !TOKEN) return;

    var allow = (form.getAttribute("data-allow-submit") || "").toLowerCase();
    var blockSubmit = !(allow === "1" || allow === "true");

    if (blockSubmit) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }

    send({ pageSlug: PAGE, submitted: true });

    if (blockSubmit) {
      try {
        var btn = form.querySelector('button[type="submit"],input[type="submit"]');
        if (btn) btn.disabled = true;

        var note = document.createElement("div");
        note.setAttribute("role","status");
        note.style.cssText = "margin-top:12px;font:13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;";
        note.textContent = "Děkujeme. Ověření bylo přijato.";
        form.appendChild(note);
      } catch(e){}
    }
  }, true);
})();
</script>`.trim();

  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return `${html}\n${script}`;
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

    let html = wrapHtml(page.name, page.html);
    html = injectLandingTracking(html, { token, slug });

    res.type("html").send(html);
  } catch (err) {
    console.error("GET /lp/:slug error", err);
    res.status(500).send("Internal server error");
  }
});

export default router;
