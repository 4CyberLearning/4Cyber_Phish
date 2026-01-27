// server/routes/campaignReports.js
import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

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
        emailTemplate: true,
        landingPage: true,
        senderIdentity: {
          include: { senderDomain: true },
        },
        targetUsers: {
          include: { user: true },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const total = campaign.targetUsers.length;
    const count = (fn) => campaign.targetUsers.filter(fn).length;
    const rate = (value) =>
      total > 0 ? Math.round((value / total) * 100) : 0;

    const sent = count((cu) => cu.sentAt);
    const opened = count((cu) => cu.openedAt);
    const clicked = count((cu) => cu.clickedAt);
    const submitted = count((cu) => cu.submittedAt);
    const reported = count((cu) => cu.reportedAt);

    res.json({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,

      emailTemplate: campaign.emailTemplate && {
        id: campaign.emailTemplate.id,
        name: campaign.emailTemplate.name,
      },

      landingPage: campaign.landingPage && {
        id: campaign.landingPage.id,
        name: campaign.landingPage.name,
        urlSlug: campaign.landingPage.urlSlug,
      },

      senderIdentity: campaign.senderIdentity && {
        id: campaign.senderIdentity.id,
        fromName: campaign.senderIdentity.fromName,
        localPart: campaign.senderIdentity.localPart,
        replyTo: campaign.senderIdentity.replyTo,
        senderDomain: campaign.senderIdentity.senderDomain && {
          id: campaign.senderIdentity.senderDomain.id,
          domain: campaign.senderIdentity.senderDomain.domain,
        },
      },

      metrics: {
        totalRecipients: total,
        sent,
        opened,
        clicked,
        submitted,
        reported,
        sentRate: rate(sent),
        openRate: rate(opened),
        clickRate: rate(clicked),
        submitRate: rate(submitted),
        reportRate: rate(reported),
      },

      recipients: campaign.targetUsers.map((cu) => ({
        id: cu.id,
        userId: cu.userId,
        email: cu.user?.email || null,
        fullName: cu.user?.fullName || null,
        department: cu.user?.department || null,
        role: cu.user?.role || null,
        sentAt: cu.sentAt,
        openedAt: cu.openedAt,
        clickedAt: cu.clickedAt,
        submittedAt: cu.submittedAt,
        reportedAt: cu.reportedAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/campaigns/:id/report error", err);
    res.status(500).json({ error: "Failed to load campaign report" });
  }
});

export default router;
