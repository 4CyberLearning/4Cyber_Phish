// server/routes/tracking.js
import { Router } from "express";
import { InteractionType } from "@prisma/client";
import prisma from "../db/prisma.js";

const router = Router();

// základ pro veřejný web (landing stránky)
const WEB_BASE =
  (process.env.PUBLIC_WEB_BASE_URL || process.env.PUBLIC_BASE_URL || "").replace(
    /\/$/,
    ""
  );

// 1x1 transparentní GIF (base64)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAEACAkQBADs=",
  "base64"
);

function noCache(res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendPixel(res) {
  noCache(res);
  res.status(200);
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", PIXEL.length);
  res.end(PIXEL);
}

function safeDecodeURIComponent(v) {
  try {
    return decodeURIComponent(String(v));
  } catch {
    return null;
  }
}

function normalizeRedirectTarget(rawTarget) {
  // povol: http/https absolutní nebo relativní "/..."
  if (!rawTarget) return "/";

  const t = String(rawTarget).trim();
  if (!t) return "/";

  // relativní
  if (t.startsWith("/")) {
    return WEB_BASE ? WEB_BASE + t : t;
  }

  // absolutní
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "/";
    return u.toString();
  } catch {
    return "/";
  }
}

async function recordInteraction(cu, type, meta) {
  const metaValue =
    meta && typeof meta === "object" && Object.keys(meta).length > 0
      ? meta
      : undefined;

  const now = new Date();
  const updates = {};

  if (type === InteractionType.EMAIL_SENT) {
    updates.delivered = true;
    if (!cu.sentAt) updates.sentAt = now;
  }
  if (type === InteractionType.OPENED && !cu.openedAt) {
    updates.openedAt = now;
  }
  if (type === InteractionType.CLICKED && !cu.clickedAt) {
    updates.clickedAt = now;
  }
  if (type === InteractionType.SUBMITTED && !cu.submittedAt) {
    updates.submittedAt = now;
  }
  if (type === InteractionType.REPORTED && !cu.reportedAt) {
    updates.reportedAt = now;
  }

  const tx = [
    prisma.interaction.create({
      data: {
        campaignId: cu.campaignId,
        userId: cu.userId,
        campaignUserId: cu.id,
        type,
        meta: metaValue,
      },
    }),
  ];

  if (Object.keys(updates).length > 0) {
    tx.push(
      prisma.campaignUser.update({
        where: { id: cu.id },
        data: updates,
      })
    );
  }

  await prisma.$transaction(tx);
}

// ---- OPEN pixel: GET /t/o/:token.gif ----
router.get("/o/:token.gif", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return sendPixel(res);

    const cu = await prisma.campaignUser.findUnique({
      where: { trackingToken: token },
    });

    if (cu) {
      await recordInteraction(cu, InteractionType.OPENED);
    }
  } catch (e) {
    console.error("OPEN tracking error", e);
  } finally {
    // vždy vrátíme pixel, i když chyba
    sendPixel(res);
  }
});

// ---- CLICK: GET /t/c/:token?u=<encodedTarget> ----
router.get("/c/:token", async (req, res) => {
  noCache(res);

  const token = String(req.params.token || "").trim();
  const decoded = req.query.u ? safeDecodeURIComponent(req.query.u) : null;

  // default redirect (bezpečné)
  const redirectTarget = normalizeRedirectTarget(decoded);

  try {
    if (token) {
      const cu = await prisma.campaignUser.findUnique({
        where: { trackingToken: token },
      });

      if (cu) {
        await recordInteraction(cu, InteractionType.CLICKED);
      }
    }
  } catch (e) {
    console.error("CLICK tracking error", e);
  } finally {
    res.redirect(302, redirectTarget);
  }
});

// ---- LANDING FORM SUBMIT: POST /t/s/:token ----
// Ukládá pouze reakci + boolean flagy, nikdy hodnoty z formuláře.
router.post("/s/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(404).json({ ok: false });

    const cu = await prisma.campaignUser.findUnique({
      where: { trackingToken: token },
    });
    if (!cu) return res.status(404).json({ ok: false });

    const pageSlug =
      typeof req.body?.pageSlug === "string"
        ? req.body.pageSlug.slice(0, 200)
        : null;

    await recordInteraction(cu, InteractionType.SUBMITTED, {
      pageSlug,
      submitted: true,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Landing submit tracking error:", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
