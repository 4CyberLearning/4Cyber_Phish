import { Router } from "express";
import prisma from "../db/prisma.js";
import { getTenantId } from "../utils/tenantScope.js";
import { serializeLifecycleEvent } from "../services/campaignLifecycle.js";

const router = Router();


function toIso(value) {
  return value?.toISOString?.() || value || null;
}

// GET /api/campaigns/:id/report
router.get("/campaigns/:id/report", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        package: true,
        emailTemplate: true,
        landingPage: true,
        senderIdentity: {
          include: { senderDomain: true },
        },
        targetGroup: {
          include: {
            _count: { select: { members: true } },
          },
        },
        targetUsers: {
          include: { user: true },
          orderBy: { id: "asc" },
        },
        lifecycleEvents: {
          orderBy: { timestamp: "desc" },
          take: 50,
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const total = Number(campaign.recipientCountSnapshot || campaign.targetUsers.length || 0);
    const count = (fn) => campaign.targetUsers.filter(fn).length;
    const rate = (value, base = total) =>
      base > 0 ? Math.round((value / base) * 10000) / 100 : 0;

    const sent = count((cu) => cu.sentAt);
    const delivered = count((cu) => cu.delivered);
    const opened = count((cu) => cu.openedAt);
    const clicked = count((cu) => cu.clickedAt);
    const submitted = count((cu) => cu.submittedAt);
    const reported = count((cu) => cu.reportedAt);
    const bounced = Math.max(0, sent - delivered);
    const submitEligible = delivered;

    const senderDomain = campaign.senderIdentity?.senderDomain?.domain || "";
    const senderEmail =
      campaign.senderIdentity?.localPart && senderDomain
        ? `${campaign.senderIdentity.localPart}@${senderDomain}`
        : "";

    res.json({
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description || "",
      status: campaign.status,
      source: campaign.source,
      targetType: campaign.targetType,
      statusReason: campaign.statusReason || null,
      finishReason: campaign.finishReason || null,
      scheduledAt: toIso(campaign.scheduledAt),
      cutoffAt: toIso(campaign.cutoffAt),
      startedAt: toIso(campaign.startedAt),
      finishedAt: toIso(campaign.finishedAt),
      cancelledAt: toIso(campaign.cancelledAt),
      createdAt: toIso(campaign.createdAt),
      updatedAt: toIso(campaign.updatedAt),
      recipientCountSnapshot: total,

      package: campaign.package && {
        id: campaign.package.id,
        name: campaign.package.name,
        description: campaign.package.description || "",
        category: campaign.package.category || "",
        difficulty: campaign.package.difficulty ?? 1,
      },

      emailTemplate: campaign.emailTemplate && {
        id: campaign.emailTemplate.id,
        name: campaign.emailTemplate.name,
        subject: campaign.emailTemplate.subject,
      },

      landingPage: campaign.landingPage && {
        id: campaign.landingPage.id,
        name: campaign.landingPage.name,
        urlSlug: campaign.landingPage.urlSlug,
      },

      senderIdentity: campaign.senderIdentity && {
        id: campaign.senderIdentity.id,
        name: campaign.senderIdentity.name,
        fromName: campaign.senderIdentity.fromName,
        email: senderEmail,
        replyTo: campaign.senderIdentity.replyTo || senderEmail,
        senderDomain: campaign.senderIdentity.senderDomain && {
          id: campaign.senderIdentity.senderDomain.id,
          domain: campaign.senderIdentity.senderDomain.domain,
        },
      },

      targetGroup: campaign.targetGroup && {
        id: campaign.targetGroup.id,
        name: campaign.targetGroup.name,
        description: campaign.targetGroup.description || "",
        memberCount: Number(campaign.targetGroup._count?.members || 0),
      },

      metrics: {
        totalRecipients: total,
        sent,
        delivered,
        opened,
        clicked,
        submitted,
        reported,
        bounced,
        submitEligible,
        sentRate: rate(sent),
        deliveryRate: rate(delivered),
        openRate: rate(opened, delivered || total),
        clickRate: rate(clicked, delivered || total),
        submitRate: rate(submitted, submitEligible || total),
        reportRate: rate(reported, delivered || total),
      },

      lifecycleEvents: campaign.lifecycleEvents.map(serializeLifecycleEvent),

      recipients: campaign.targetUsers.map((cu) => ({
        id: cu.id,
        userId: cu.userId,
        userPublicId: cu.user?.externalUserPublicId || cu.externalUserPublicId || null,
        email: cu.user?.email || null,
        fullName: cu.user?.fullName || null,
        department: cu.user?.department || null,
        role: cu.user?.role || null,
        delivered: !!cu.delivered,
        sentAt: toIso(cu.sentAt),
        openedAt: toIso(cu.openedAt),
        clickedAt: toIso(cu.clickedAt),
        submittedAt: toIso(cu.submittedAt),
        reportedAt: toIso(cu.reportedAt),
      })),
    });
  } catch (err) {
    console.error("GET /api/campaigns/:id/report error", err);
    res.status(500).json({ error: "Failed to load campaign report" });
  }
});

export default router;
