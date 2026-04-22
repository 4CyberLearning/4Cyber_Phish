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
    process.env.PHISH_TRAINING_VIDEO_URL || "/uploads/phishing-training.mp4"
  );

  const listHtml = bullets
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const videoHtml = videoUrl
    ? `<div class="video-frame">
         <video
           class="training-video"
           controls
           autoplay
           muted
           playsinline
           preload="auto"
         >
           <source src="${escapeHtml(videoUrl)}" type="video/mp4">
           Váš prohlížeč nepodporuje přehrání videa.
         </video>
       </div>
       <p class="video-note">
         Video se spustí automaticky bez zvuku. Zvuk lze zapnout přímo v přehrávači.
       </p>`
    : `<div class="video-missing">
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

    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      background: linear-gradient(180deg, #f3f7fb 0%, #edf3f9 100%);
      color: #0f172a;
    }

    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 18px;
    }

    .card {
      width: min(1180px, 100%);
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 28px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      overflow: hidden;
      padding: 34px 34px 28px;
    }

    .hero {
      text-align: center;
      max-width: 980px;
      margin: 0 auto 26px;
    }

    .eyebrow {
      display: inline-flex;
      padding: 8px 12px;
      border-radius: 999px;
      background: #e7f5ff;
      color: #0b6aa8;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
    }

    h1 {
      margin: 16px 0 12px;
      font-size: clamp(30px, 4.5vw, 52px);
      line-height: 1.05;
    }

    .lead {
      margin: 0 auto;
      max-width: 900px;
      color: #334155;
      font-size: 18px;
      line-height: 1.65;
    }

    .video-section {
      max-width: 980px;
      margin: 0 auto 28px;
    }

    .video-frame {
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.22);
    }

    .training-video {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
    }

    .video-note {
      margin: 12px 0 0;
      text-align: center;
      color: #64748b;
      font-size: 14px;
    }

    .video-missing {
      padding: 18px 20px;
      border-radius: 16px;
      background: #eef6ff;
      color: #244160;
      text-align: center;
    }

    .tips {
      max-width: 900px;
      margin: 0 auto;
      background: #f8fbff;
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 22px;
      padding: 26px 28px;
    }

    .tips h2 {
      margin: 0 0 14px;
      text-align: center;
      font-size: 26px;
    }

    .tips ul {
      margin: 0;
      padding-left: 22px;
      color: #334155;
      line-height: 1.8;
      font-size: 17px;
    }

    .tips li + li {
      margin-top: 8px;
    }

    .footer {
      padding-top: 24px;
      text-align: center;
      color: #64748b;
      font-size: 14px;
    }

    @media (max-width: 900px) {
      .card {
        padding: 24px 18px 22px;
        border-radius: 22px;
      }

      h1 {
        font-size: clamp(28px, 8vw, 40px);
      }

      .lead {
        font-size: 16px;
      }

      .tips {
        padding: 20px 18px;
      }

      .tips h2 {
        font-size: 22px;
      }

      .tips ul {
        font-size: 16px;
      }
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

      <div class="video-section">
        ${videoHtml}
      </div>

      <section class="tips">
        <h2>Jak poznat, že šlo o phishing</h2>
        <ul>${listHtml}</ul>
      </section>

      <div class="footer">
        Tento obsah je součástí interního bezpečnostního vzdělávání.
      </div>
    </div>
  </div>
</body>
</html>`);
});

export default router;