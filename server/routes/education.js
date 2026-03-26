import express from "express";

const router = express.Router();

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeVideoUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return "";
  } catch {
    return "";
  }
}

router.get("/default", (req, res) => {
  const title =
    process.env.PHISH_TRAINING_TITLE || "Toto byla phishingová simulace";

  const lead =
    process.env.PHISH_TRAINING_LEAD ||
    "Právě jste dokončil(a) cvičnou phishingovou kampaň. Cílem bylo ukázat, jak může vypadat podvodná stránka a na co si dát příště pozor.";

  const bullets = (
    process.env.PHISH_TRAINING_POINTS ||
    "Zkontrolujte doménu a vzhled přihlašovací stránky.|Ověřujte neočekávané výzvy k zadání hesla.|Nikdy neposílejte heslo po kliknutí z neověřeného e-mailu.|Při podezření zprávu nahlaste."
  )
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  const videoUrl = normalizeVideoUrl(
    process.env.PHISH_TRAINING_VIDEO_URL || "/training/phishing-awareness.mp4"
  );

  const listHtml = bullets
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const videoHtml = videoUrl
    ? `<video controls playsinline preload="metadata" style="width:100%;max-width:900px;border-radius:16px;background:#000;box-shadow:0 18px 50px rgba(0,0,0,.18);">
         <source src="${escapeHtml(videoUrl)}" type="video/mp4">
         Váš prohlížeč nepodporuje přehrání videa.
       </video>`
    : `<div style="padding:18px 20px;border-radius:14px;background:#eef6ff;color:#244160;">
         Video není zatím nakonfigurováno. Nastavte PHISH_TRAINING_VIDEO_URL.
       </div>`;

  res.type("html").send(`<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, Segoe UI, Arial, sans-serif; background:#f4f8fc; color:#0f172a; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 18px; }
    .card { width:min(1120px,100%); background:#fff; border:1px solid rgba(15,23,42,.06); border-radius:24px; box-shadow:0 24px 70px rgba(15,23,42,.12); overflow:hidden; }
    .hero { padding:28px 28px 10px; }
    .eyebrow { display:inline-flex; padding:8px 12px; border-radius:999px; background:#e7f5ff; color:#0b6aa8; font-size:12px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; }
    h1 { margin:16px 0 10px; font-size:clamp(28px,4vw,42px); line-height:1.08; }
    .lead { margin:0; max-width:860px; color:#334155; font-size:17px; line-height:1.6; }
    .body { display:grid; gap:24px; grid-template-columns:minmax(0, 1.1fr) minmax(320px, .9fr); padding:24px 28px 30px; }
    .video { display:flex; align-items:flex-start; justify-content:center; }
    .tips { background:#f8fbff; border:1px solid rgba(15,23,42,.06); border-radius:20px; padding:22px 24px; }
    .tips h2 { margin:0 0 12px; font-size:20px; }
    .tips ul { margin:0; padding-left:20px; color:#334155; line-height:1.7; }
    .tips li + li { margin-top:8px; }
    .footer { padding:0 28px 28px; color:#64748b; font-size:14px; }
    @media (max-width: 900px) {
      .body { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hero">
        <span class="eyebrow">Bezpečnostní školení</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(lead)}</p>
      </div>
      <div class="body">
        <div class="video">${videoHtml}</div>
        <aside class="tips">
          <h2>Na co si dát příště pozor</h2>
          <ul>${listHtml}</ul>
        </aside>
      </div>
      <div class="footer">
        Tento obsah je součástí interního bezpečnostního vzdělávání.
      </div>
    </div>
  </div>
</body>
</html>`);
});

export default router;