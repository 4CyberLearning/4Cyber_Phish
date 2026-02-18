// server/routes/campaigns.js
import { Router } from 'express';
import { PrismaClient, CampaignStatus, InteractionType } from '@prisma/client';
import { sendMail } from '../utils/mailer.js';
import { instrumentEmailHtml, renderEmailTemplate } from '../utils/emailTracking.js';
import prisma from "../db/prisma.js";

const router = Router();

function toSet(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(/[,\s;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function buildSendPolicy(tenantId) {
  const envAllowedRecipients = toSet(process.env.ALLOWED_RECIPIENTS || "");
  const envAllowedDomains = toSet(process.env.ALLOWED_RECIPIENT_DOMAINS || "");
  const envAllowedFromDomains = toSet(process.env.ALLOWED_FROM_DOMAINS || "");

  const dbDomains = await prisma.allowedRecipientDomain.findMany({
    where: { tenantId },
    select: { domain: true },
    orderBy: { createdAt: "asc" },
  });

  const allowedRecipientDomains = new Set([
    ...envAllowedDomains,
    ...dbDomains.map((d) => String(d.domain).trim().toLowerCase()).filter(Boolean),
  ]);

  return {
    allowedRecipients: envAllowedRecipients,
    allowedRecipientDomains,
    allowedFromDomains: envAllowedFromDomains,
  };
}

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

// POST /api/campaigns/:id/targets/group
router.post("/campaigns/:id/targets/group", async (req, res) => {
  const campaignId = Number(req.params.id);
  const groupId = Number(req.body?.groupId);

  if (!Number.isInteger(campaignId) || !Number.isInteger(groupId)) {
    return res.status(400).json({ error: "Invalid campaignId/groupId" });
  }

  try {
    const tenantId = await getTenantId();

    const [campaign, group] = await Promise.all([
      prisma.campaign.findFirst({ where: { id: campaignId, tenantId }, select: { id: true } }),
      prisma.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } }),
    ]);

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (!group) return res.status(404).json({ error: "Group not found" });

    // načti userIds ve skupině
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);

    await prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: { targetGroupId: groupId },
      });

      await tx.campaignUser.deleteMany({ where: { campaignId } });

      if (userIds.length) {
        await tx.campaignUser.createMany({
          data: userIds.map((userId) => ({ campaignId, userId })),
          skipDuplicates: true,
        });
      }
    });

    return res.json({ ok: true, count: userIds.length });
  } catch (e) {
    console.error("POST /campaigns/:id/targets/group failed", e);
    return res.status(500).json({ error: e.message || "Failed" });
  }
});

// DELETE /api/campaigns/:id – smazání kampaně
router.delete('/campaigns/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const tenantId = await getTenantId();

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    await prisma.campaign.delete({ where: { id } });
    return res.status(204).end();
  } catch (e) {
    console.error('DELETE /campaigns/:id failed', e);
    res.status(500).json({ error: e.message || 'Failed to delete campaign' });
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

// POST /api/campaigns – vytvoření kampaně (minimálně jen name + description)
router.post("/campaigns", async (req, res) => {
  const {
    name,
    description,
    scheduledAt,
    emailTemplateId,
    landingPageId,
    senderIdentityId,
    userIds,
  } = req.body || {};

  const n = String(name || "").trim();
  if (!n) {
    return res.status(400).json({ error: "Name is required" });
  }

  // userIds je volitelné, ale když je poslané, musí to být array
  if (userIds !== undefined && !Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array" });
  }

  // scheduledAt volitelné, validace
  const sched = scheduledAt ? new Date(scheduledAt) : new Date();
  if (sched && Number.isNaN(sched.getTime())) {
    return res.status(400).json({ error: "Invalid scheduledAt" });
  }

  // optional ids: když jsou poslané, musí být integer
  const parseOptionalInt = (v, key) => {
    if (v === undefined || v === null || v === "") return null;
    const num = Number(v);
    if (!Number.isInteger(num)) throw new Error(`Invalid ${key}`);
    return num;
  };

  try {
    const tenantId = await getTenantId();

    let tplId = null;
    let lpId = null;
    let sidId = null;

    try {
      tplId = parseOptionalInt(emailTemplateId, "emailTemplateId");
      lpId = parseOptionalInt(landingPageId, "landingPageId");
      sidId = parseOptionalInt(senderIdentityId, "senderIdentityId");
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const data = {
      tenantId,
      name: n,
      description: String(description || "").trim() || null,
      scheduledAt: sched,
      status: CampaignStatus.SCHEDULED,
      emailTemplateId: tplId,
      landingPageId: lpId,
      senderIdentityId: sidId,
    };

    if (Array.isArray(userIds) && userIds.length > 0) {
      const ids = userIds
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0);

      if (ids.length > 0) {
        data.targetUsers = {
          create: ids.map((uid) => ({ userId: uid })),
        };
      }
    }

    const created = await prisma.campaign.create({
      data,
      include: {
        emailTemplate: true,
        landingPage: true,
        senderIdentity: { include: { senderDomain: true } },
        targetUsers: { include: { user: true } },
      },
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("POST /campaigns failed", e);
    res.status(500).json({ error: e.message || "Failed to create campaign" });
  }
});

// pomocná funkce – odeslání mailů a zapsání EMAIL_SENT
async function sendCampaignEmails(campaignId, tenantId) {
  const sendPolicy = await buildSendPolicy(tenantId);
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

  if (!campaign) { throw new Error('Campaign not found');
  if (!campaign.emailTemplate) throw new Error('Campaign is missing emailTemplate');
  if (!campaign.landingPage) throw new Error('Campaign is missing landingPage');
  if (!campaign.senderIdentity) throw new Error('Campaign is missing senderIdentity');
  }

  const now = new Date();

  let from;
  let replyTo;
  let smtpUser;

  if (campaign.senderIdentity) {
    const local = campaign.senderIdentity.localPart;
    const domain = campaign.senderIdentity.senderDomain?.domain;
    const email = local && domain ? `${local}@${domain}` : undefined;

    if (email) {
      smtpUser = String(email).trim().toLowerCase();
      const fromName = campaign.senderIdentity.fromName || smtpUser;
      from = `${fromName} <${smtpUser}>`;
    }

    if (campaign.senderIdentity.replyTo) {
      replyTo = campaign.senderIdentity.replyTo;
    }
  }

  if (!smtpUser) {
    throw new Error("Sender identity is required (smtpUser is missing).");
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
      smtpUser, // <- klíčové pro výběr 1 ze 4 mailboxů
      from,
      replyTo,
      to: cu.user.email,
      subject: campaign.emailTemplate.subject,
      html: htmlTracked,
      policy: sendPolicy,
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
  /*
  if (process.env.EMAIL_SENDING_ENABLED !== "true") {
    return res.status(403).json({ error: "Email sending je vypnuté (EMAIL_SENDING_ENABLED=false)." });
  }
  */
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
