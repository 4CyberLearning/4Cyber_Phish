// server/routes/tracking.js
import { Router } from "express";
import { PrismaClient, InteractionType } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// 1x1 transparentní GIF (base64)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAEACAkQBADs=",
  "base64"
);

function sendPixel(res) {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Content-Length", PIXEL.length);
  res.end(PIXEL, "binary");
}

async function recordInteraction(cu, type, meta = {}) {
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
        meta,
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
    const token = req.params.token;
    const cu = await prisma.campaignUser.findUnique({
      where: { trackingToken: token },
    });

    if (cu) {
      await recordInteraction(cu, InteractionType.OPENED, {
        ua: req.get("user-agent") || null,
        ip: req.ip,
      });
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
  const token = req.params.token;
  const target = req.query.u ? decodeURIComponent(String(req.query.u)) : null;

  try {
    const cu = await prisma.campaignUser.findUnique({
      where: { trackingToken: token },
    });

    if (cu) {
      await recordInteraction(cu, InteractionType.CLICKED, {
        target,
        ua: req.get("user-agent") || null,
        ip: req.ip,
      });
    }
  } catch (e) {
    console.error("CLICK tracking error", e);
  } finally {
    // kam přesměrovat – zatím použij cílový URL nebo root
    res.redirect(302, target || "/");
  }
});

export default router;
