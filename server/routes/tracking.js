import express from "express";
import { InteractionType } from "@prisma/client";
import prisma from "../db/prisma.js";

const router = express.Router();

const WEB_BASE = String(process.env.PUBLIC_WEB_BASE_URL || "").replace(/\/$/, "");

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

function sendPixel(res) {
  const pixel = Buffer.from(
    "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
    "base64"
  );
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", pixel.length);
  noCache(res);
  res.end(pixel);
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeRedirectTarget(raw) {
  if (!raw) return "/";
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "/";
    return u.toString();
  } catch {
    return "/";
  }
}

function isCampaignInteractionWindowOpen(campaign) {
  if (!campaign) return false;
  if (campaign.cancelledAt) return false;
  if (campaign.finishedAt) return false;

  const now = Date.now();
  const scheduledAt = campaign.startedAt || campaign.scheduledAt;
  const cutoffAt = campaign.cutoffAt;

  if (scheduledAt && new Date(scheduledAt).getTime() > now) {
    return false;
  }

  if (cutoffAt && new Date(cutoffAt).getTime() <= now) {
    return false;
  }

  return true;
}

function absoluteAppUrl(pathname, params = {}) {
  const base = WEB_BASE || "";
  if (!base) {
    const qs = new URLSearchParams(params).toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  const url = new URL(pathname, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function resolvePostSubmitRedirect(cu) {
  const campaign = cu?.campaign;
  if (!campaign) return null;

  const type = String(campaign.postSubmitActionType || "TRAINING_PAGE").toUpperCase();

  if (type === "REDIRECT_URL") {
    const raw = String(campaign.postSubmitRedirectUrl || "").trim();
    const normalized = normalizeRedirectTarget(raw);
    return normalized !== "/" ? normalized : absoluteAppUrl("/education/default", { t: cu.trackingToken, c: campaign.id });
  }

  return absoluteAppUrl("/education/default", { t: cu.trackingToken, c: campaign.id });
}

async function loadCampaignUserWithCampaign(token) {
  return prisma.campaignUser.findUnique({
    where: { trackingToken: token },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          scheduledAt: true,
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

    const url = new URL(
      fallback || "/",
      fallback.startsWith("http") ? undefined : "http://localhost"
    );
    url.searchParams.set("phish_reported", "1");

    return res.redirect(
      302,
      fallback.startsWith("http")
        ? url.toString()
        : `${fallback}${fallback.includes("?") ? "&" : "?"}phish_reported=1`
    );
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

    const redirectTo = resolvePostSubmitRedirect(cu);
    const actionType = String(cu?.campaign?.postSubmitActionType || "TRAINING_PAGE").toUpperCase();

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