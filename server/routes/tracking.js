
// server/routes/tracking.js
import { Router } from "express";
import { CampaignPostSubmitActionType, InteractionType } from "@prisma/client";
import prisma from "../db/prisma.js";
import { isCampaignInteractionWindowOpen } from "../services/campaignLifecycle.js";

const router = Router();

const WEB_BASE =
  (process.env.PUBLIC_WEB_BASE_URL || process.env.PUBLIC_BASE_URL || "").replace(
    /\/$/,
    ""
  );

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
  if (!rawTarget) return "/";

  const t = String(rawTarget).trim();
  if (!t) return "/";

  if (t.startsWith("/")) {
    return WEB_BASE ? WEB_BASE + t : t;
  }

  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "/";
    return u.toString();
  } catch {
    return "/";
  }
}

function buildTrainingRedirect(token, campaignId) {
  const params = new URLSearchParams();
  if (token) params.set("t", token);
  if (campaignId) params.set("c", String(campaignId));
  const qs = params.toString();
  const path = `/education/default${qs ? `?${qs}` : ""}`;
  return normalizeRedirectTarget(path);
}

function resolvePostSubmitTarget(campaign, token) {
  if (!campaign) return "/";

  if (
    campaign.postSubmitActionType === CampaignPostSubmitActionType.REDIRECT_URL &&
    campaign.postSubmitRedirectUrl
  ) {
    return normalizeRedirectTarget(campaign.postSubmitRedirectUrl);
  }

  return buildTrainingRedirect(token, campaign.id);
}

async function loadCampaignUserWithCampaign(token) {
  return prisma.campaignUser.findUnique({
    where: { trackingToken: token },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          cutoffAt: true,
          finishedAt: true,
          cancelledAt: true,
          postSubmitActionType: true,
          postSubmitRedirectUrl: true,
        },
      },
    },
  });
}

async function recordInteraction(cu, type, meta) {
  if (!cu?.campaign || !isCampaignInteractionWindowOpen(cu.campaign)) {
    return false;
  }

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
  return true;
}

router.get("/o/:token.gif", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return sendPixel(res);

    const cu = await loadCampaignUserWithCampaign(token);

    if (cu) {
      await recordInteraction(cu, InteractionType.OPENED);
    }
  } catch (e) {
    console.error("OPEN tracking error", e);
  } finally {
    sendPixel(res);
  }
});

router.get("/c/:token", async (req, res) => {
  noCache(res);

  const token = String(req.params.token || "").trim();
  const decoded = req.query.u ? safeDecodeURIComponent(req.query.u) : null;
  const redirectTarget = normalizeRedirectTarget(decoded);

  try {
    if (token) {
      const cu = await loadCampaignUserWithCampaign(token);

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

router.get("/r/:token", async (req, res) => {
  noCache(res);

  const token = String(req.params.token || "").trim();
  const fallback = WEB_BASE || "/";

  try {
    if (!token) return res.redirect(302, fallback);

    const cu = await loadCampaignUserWithCampaign(token);

    if (cu) {
      await recordInteraction(cu, InteractionType.REPORTED, {
        source: "email_report_link",
      });
    }

    const url = new URL(fallback || "/", fallback.startsWith("http") ? undefined : "http://localhost");
    url.searchParams.set("phish_reported", "1");
    return res.redirect(302, fallback.startsWith("http") ? url.toString() : `${fallback}${fallback.includes("?") ? "&" : "?"}phish_reported=1`);
  } catch (e) {
    console.error("REPORT tracking error", e);
    return res.redirect(302, fallback);
  }
});

router.post("/s/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(404).json({ ok: false });

    const cu = await loadCampaignUserWithCampaign(token);
    if (!cu) return res.status(404).json({ ok: false });

    const pageSlug =
      typeof req.body?.pageSlug === "string"
        ? req.body.pageSlug.slice(0, 200)
        : null;

    const recorded = await recordInteraction(cu, InteractionType.SUBMITTED, {
      pageSlug,
      submitted: true,
    });

    const redirectTo = resolvePostSubmitTarget(cu.campaign, token);
    const actionType = cu.campaign?.postSubmitActionType || CampaignPostSubmitActionType.TRAINING_PAGE;

    return res.json({
      ok: recorded,
      actionType,
      redirectTo,
    });
  } catch (err) {
    console.error("Landing submit tracking error:", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
