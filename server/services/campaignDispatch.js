import { CampaignStatus, InteractionType } from "@prisma/client";
import prisma from "../db/prisma.js";
import { sendMail } from "../utils/mailer.js";
import { instrumentEmailHtml, renderEmailTemplate } from "../utils/emailTracking.js";

function toSet(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(/[\,\s;]+/)
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

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

function buildLandingUrl(campaign, campaignUser) {
  const slug = campaign?.landingPage?.urlSlug || String(campaign.landingPageId || "").trim();
  const base = PUBLIC_BASE.replace(/\/$/, "");
  const url = `${base}/lp/${encodeURIComponent(slug)}`;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${encodeURIComponent(campaignUser.trackingToken)}`;
}

export async function sendCampaignNow(campaignId, tenantId) {
  const sendPolicy = await buildSendPolicy(tenantId);
  const campaign = await prisma.campaign.findFirst({
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
  if (!campaign.emailTemplate) throw new Error("Campaign is missing emailTemplate");
  if (!campaign.landingPage) throw new Error("Campaign is missing landingPage");
  if (!campaign.senderIdentity) throw new Error("Campaign is missing senderIdentity");

  const totalRecipients = await prisma.campaignUser.count({ where: { campaignId, campaign: { tenantId } } });
  if (!totalRecipients) throw new Error("Campaign has no recipients (targetUsers is empty).");

  if (!campaign.targetUsers?.length) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.ACTIVE },
    });
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

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: CampaignStatus.ACTIVE },
  });

  return { ok: true, campaignId: campaign.id, sent, skippedAlreadySent: totalRecipients - sent };
}
