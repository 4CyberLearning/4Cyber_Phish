import {
  CampaignLifecycleEventType,
  CampaignSource,
  CampaignStatus,
  InteractionType,
} from "@prisma/client";
import prisma from "../db/prisma.js";
import { sendMail } from "../utils/mailer.js";
import { instrumentEmailHtml, renderEmailTemplate } from "../utils/emailTracking.js";
import { buildLifecycleEventData } from "./campaignLifecycle.js";

function toSet(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(/[\,\s;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function buildSendPolicy(tenantId, integrationCompanyScope = null) {
  const envAllowedRecipients = toSet(process.env.ALLOWED_RECIPIENTS || "");
  const envAllowedDomains = toSet(process.env.ALLOWED_RECIPIENT_DOMAINS || "");
  const envAllowedFromDomains = toSet(process.env.ALLOWED_FROM_DOMAINS || "");

  const domainWhere = integrationCompanyScope
    ? { tenantId, integrationCompanyScope }
    : { tenantId };

  const dbDomains = await prisma.allowedRecipientDomain.findMany({
    where: domainWhere,
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

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

function buildLandingUrl(campaign, campaignUser) {
  const slug = campaign?.landingPage?.urlSlug || String(campaign.landingPageId || "").trim();
  const base = PUBLIC_BASE.replace(/\/$/, "");
  const url = `${base}/lp/${encodeURIComponent(slug)}`;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${encodeURIComponent(campaignUser.trackingToken)}`;
}

async function ensureCampaignRunning(campaign, source = CampaignSource.SCHEDULER, actor = { source: "scheduler" }) {
  const now = new Date();

  if (campaign.status === CampaignStatus.RUNNING) return campaign;
  if (campaign.status === CampaignStatus.CANCELLED) throw new Error("Campaign is cancelled.");
  if (campaign.status === CampaignStatus.FINISHED) throw new Error("Campaign is already finished.");
  if (campaign.cutoffAt && new Date(campaign.cutoffAt) <= now) {
    throw new Error("Campaign cutoffAt is in the past.");
  }

  const claimed = await prisma.campaign.updateMany({
    where: {
      id: campaign.id,
      tenantId: campaign.tenantId,
      status: CampaignStatus.SCHEDULED,
    },
    data: {
      status: CampaignStatus.RUNNING,
      startedAt: campaign.startedAt || now,
      statusReason: source === CampaignSource.SCHEDULER ? "started_by_scheduler" : "started_manually",
      source,
    },
  });

  if (claimed.count) {
    await prisma.campaignLifecycleEvent.create({
      data: buildLifecycleEventData({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        type: CampaignLifecycleEventType.STARTED,
        actor,
        reason: source === CampaignSource.SCHEDULER ? "scheduled_at_reached" : "send_now",
        meta: { source },
        createdAt: now,
      }),
    });
  }

  return prisma.campaign.findFirst({
    where: { id: campaign.id, tenantId: campaign.tenantId },
    include: {
      emailTemplate: true,
      landingPage: true,
      senderIdentity: {
        include: { senderDomain: true },
      },
      targetUsers: {
        where: { sentAt: null },
        include: { user: true },
      },
    },
  });
}

export async function sendCampaignNow(campaignId, tenantId, options = {}) {
  const source = options.source || CampaignSource.SCHEDULER;
  const actor = options.actor || { source: source === CampaignSource.SCHEDULER ? "scheduler" : "local_admin" };
  let campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: {
      emailTemplate: true,
      landingPage: true,
      senderIdentity: {
        include: { senderDomain: true },
      },
      targetUsers: {
        where: { sentAt: null },
        include: { user: true },
      },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  const sendPolicy = await buildSendPolicy(
    tenantId,
    campaign.integrationCompanyScope || null,
  );

  if (!campaign) throw new Error("Campaign not found");
  campaign = await ensureCampaignRunning(campaign, source, actor);
  if (!campaign) throw new Error("Campaign not found after transition");
  if (!campaign.emailTemplate) throw new Error("Campaign is missing emailTemplate");
  if (!campaign.landingPage) throw new Error("Campaign is missing landingPage");
  if (!campaign.senderIdentity) throw new Error("Campaign is missing senderIdentity");

  const totalRecipients = await prisma.campaignUser.count({ where: { campaignId, campaign: { tenantId } } });
  if (!totalRecipients) throw new Error("Campaign has no recipients (targetUsers is empty).");

  if (!campaign.targetUsers?.length) {
    return { ok: true, campaignId: campaign.id, sent: 0, skippedAlreadySent: totalRecipients };
  }

  const now = new Date();
  const smtpUser = String(process.env.SMTP_USER || "").trim().toLowerCase();
  if (!smtpUser) throw new Error("SMTP_USER is missing in env (auth mailbox).");

  let from;
  let replyTo;

  const local = campaign.senderIdentity.localPart;
  const domain = campaign.senderIdentity.senderDomain?.domain;
  const fromEmail = local && domain ? `${local}@${domain}` : null;
  if (fromEmail) {
    const fromName = campaign.senderIdentity.fromName || fromEmail;
    from = `${fromName} <${fromEmail}>`;
  }
  if (campaign.senderIdentity.replyTo) replyTo = campaign.senderIdentity.replyTo;
  if (!from) throw new Error("Sender identity is required (from address is missing).");

  let sent = 0;

  for (const cu of campaign.targetUsers) {
    const userName = cu.user.fullName || cu.user.email;
    const landingUrl = buildLandingUrl(campaign, cu);
    const htmlRendered = renderEmailTemplate(campaign.emailTemplate.bodyHtml, {
      name: userName,
      email: cu.user.email,
      link: landingUrl,
    });
    const htmlTracked = instrumentEmailHtml(htmlRendered, cu.trackingToken);

    await sendMail({
      smtpUser,
      from,
      replyTo,
      to: cu.user.email,
      subject: campaign.emailTemplate.subject,
      html: htmlTracked,
      policy: sendPolicy,
    });

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

    sent += 1;
  }

  return { ok: true, campaignId: campaign.id, sent, skippedAlreadySent: totalRecipients - sent };
}
