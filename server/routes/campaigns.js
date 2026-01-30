// server/routes/campaigns.js
import { Router } from 'express';
import { PrismaClient, CampaignStatus, InteractionType } from '@prisma/client';
import { sendMail } from '../utils/mailer.js';
import { instrumentEmailHtml, renderEmailTemplate } from '../utils/emailTracking.js';
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

const APP_BASE =
  (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || process.env.TRACKING_BASE_URL || APP_BASE).replace(/\/$/, "");

function buildLandingUrl(campaign, campaignUser) {
  const slug = campaign?.landingPage?.urlSlug || String(campaign.landingPageId || "").trim();
  const base = PUBLIC_BASE.replace(/\/$/, "");
  const url = `${base}/lp/${encodeURIComponent(slug)}`;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${encodeURIComponent(campaignUser.trackingToken)}`;
}

// GET /api/campaigns – seznam kampaní
router.get('/campaigns', async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const rows = await prisma.campaign.findMany({
      where: { tenantId },
      include: {
        emailTemplate: true,
        landingPage: true,
        senderIdentity: {
          include: { senderDomain: true },
        },
        targetUsers: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rows);
  } catch (e) {
    console.error('GET /campaigns failed', e);
    res.status(500).json({ error: e.message || 'Failed to load campaigns' });
  }
});

// GET /api/campaigns/:id – detail
router.get('/campaigns/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const tenantId = await getTenantId();
    const row = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        emailTemplate: true,
        landingPage: true,
        senderIdentity: {
          include: { senderDomain: true },
        },
        targetUsers: { include: { user: true } },
        interactions: true,
      },
    });

    if (!row) return res.status(404).json({ error: 'Campaign not found' });
    res.json(row);
  } catch (e) {
    console.error('GET /campaigns/:id failed', e);
    res.status(500).json({ error: e.message || 'Failed to load campaign' });
  }
});

// PATCH /api/campaigns/:id – průběžná konfigurace kampaně (wizard)
router.patch("/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    const body = req.body || {};
    const data = {};

    if (body.name !== undefined) {
      const v = String(body.name || "").trim();
      if (!v) return res.status(400).json({ error: "Name is required" });
      data.name = v;
    }

    if (body.description !== undefined) {
      const v = String(body.description || "").trim();
      data.description = v ? v : null;
    }

    if (body.scheduledAt !== undefined) {
      const d = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (d && Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid scheduledAt" });
      }
      if (d) data.scheduledAt = d;
    }

    if (body.landingPageId !== undefined) {
      const v = Number(body.landingPageId);
      if (!Number.isInteger(v)) {
        return res.status(400).json({ error: "Invalid landingPageId" });
      }
      data.landingPageId = v;
    }

    if (body.emailTemplateId !== undefined) {
      const v = Number(body.emailTemplateId);
      if (!Number.isInteger(v)) {
        return res.status(400).json({ error: "Invalid emailTemplateId" });
      }
      data.emailTemplateId = v;
    }

    if (body.senderIdentityId !== undefined) {
      if (body.senderIdentityId === null || body.senderIdentityId === "") {
        data.senderIdentityId = null;
      } else {
        const v = Number(body.senderIdentityId);
        if (!Number.isInteger(v)) {
          return res.status(400).json({ error: "Invalid senderIdentityId" });
        }
        data.senderIdentityId = v;
      }
    }

    // volitelné: přepsání příjemců (krok 4)
    if (body.userIds !== undefined) {
      if (!Array.isArray(body.userIds)) {
        return res.status(400).json({ error: "userIds must be an array" });
      }
      const userIds = body.userIds
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0);

      data.targetUsers = {
        deleteMany: {},
        create: userIds.map((uid) => ({ userId: uid })),
      };
    }

    // když není co měnit, vrať detail
    if (Object.keys(data).length === 0) {
      const row = await prisma.campaign.findFirst({
        where: { id, tenantId },
        include: {
          emailTemplate: true,
          landingPage: true,
          senderIdentity: { include: { senderDomain: true } },
          targetUsers: { include: { user: true } },
          interactions: true,
        },
      });
      return res.json(row);
    }

    await prisma.campaign.update({
      where: { id },
      data,
    });

    const row = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        emailTemplate: true,
        landingPage: true,
        senderIdentity: { include: { senderDomain: true } },
        targetUsers: { include: { user: true } },
        interactions: true,
      },
    });

    res.json(row);
  } catch (e) {
    console.error("PATCH /campaigns/:id failed", e);
    res.status(500).json({ error: e.message || "Failed to update campaign" });
  }
});

// POST /api/campaigns – vytvoření kampaně
router.post('/campaigns', async (req, res) => {
  const {
    name,
    description,
    scheduledAt,
    emailTemplateId,
    landingPageId,
    senderIdentityId,
    userIds = [],
  } = req.body || {};
  if (
    !name ||
    !emailTemplateId ||
    !landingPageId ||
    !Array.isArray(userIds) ||
    userIds.length === 0
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const tenantId = await getTenantId();
    const data = await prisma.campaign.create({
      data: {
        tenantId,
        name,
        description: description || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        status: CampaignStatus.SCHEDULED,
        emailTemplateId: Number(emailTemplateId),
        landingPageId: Number(landingPageId),
        senderIdentityId: senderIdentityId ? Number(senderIdentityId) : null,
        targetUsers: {
          // trackingToken = default(uuid())
          create: userIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        emailTemplate: true,
        landingPage: true,
        senderIdentity: {
          include: { senderDomain: true },
        },
        targetUsers: { include: { user: true } },
      },
    });
    res.status(201).json(data);
  } catch (e) {

    console.error('POST /campaigns failed', e);
    res.status(500).json({ error: e.message || 'Failed to create campaign' });
  }
});

// pomocná funkce – odeslání mailů a zapsání EMAIL_SENT
async function sendCampaignEmails(campaignId, tenantId) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: {
      emailTemplate: true,
      landingPage: true, // ✅ nutné pro urlSlug
      senderIdentity: {
        include: { senderDomain: true },
      },
      targetUsers: { include: { user: true } },
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const now = new Date();

  let from;
  let replyTo;

  if (campaign.senderIdentity) {
    const local = campaign.senderIdentity.localPart;
    const domain = campaign.senderIdentity.senderDomain?.domain;
    const email =
      local && domain ? `${local}@${domain}` : undefined;

    if (email) {
      from = `${campaign.senderIdentity.fromName} <${email}>`;
    }

    if (campaign.senderIdentity.replyTo) {
      replyTo = campaign.senderIdentity.replyTo;
    }
  }

  for (const cu of campaign.targetUsers) {
    const userName = cu.user.fullName || cu.user.email;
    const landingUrl = buildLandingUrl(campaign, cu);

    // 1) doplnit placeholdery do HTML
    const htmlRendered = renderEmailTemplate(campaign.emailTemplate.bodyHtml, {
      name: userName,
      email: cu.user.email,
      link: landingUrl,
    });

    // 2) přidat tracking pixel + přepsat odkazy
    const htmlTracked = instrumentEmailHtml(htmlRendered, cu.trackingToken);

    // 3) odeslat e-mail
    const info = await sendMail({
      from,
      replyTo,
      to: cu.user.email,
      subject: campaign.emailTemplate.subject,
      html: htmlTracked,
    });

    // 4) zapsat EMAIL_SENT + agregace
    await prisma.$transaction([
      prisma.interaction.create({
        data: {
          campaignId: campaign.id,
          userId: cu.userId,
          campaignUserId: cu.id,
          type: InteractionType.EMAIL_SENT,
        },
      }),
      prisma.campaignUser.update({
        where: { id: cu.id },
        data: {
          delivered: true,
          sentAt: now,
        },
      }),
    ]);
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: CampaignStatus.ACTIVE },
  });
}

// POST /api/campaigns/:id/send-now – okamžité odeslání kampaně
router.post('/campaigns/:id/send-now', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const tenantId = await getTenantId();
    await sendCampaignEmails(id, tenantId);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /campaigns/:id/send-now failed', e);
    res.status(500).json({ error: e.message || 'Failed to send campaign' });
  }
});

export default router;
