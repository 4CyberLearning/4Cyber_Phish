import {
  CampaignActorType,
  CampaignLifecycleEventType,
  CampaignPostSubmitActionType,
  CampaignSource,
  CampaignStatus,
  CampaignTargetType,
} from "@prisma/client";

export const campaignIntegrationInclude = {
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
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          department: true,
          role: true,
          isActive: true,
          externalUserPublicId: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
  lifecycleEvents: {
    orderBy: { createdAt: "desc" },
    take: 20,
  },
};

export function parseDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeCampaignActor(input, fallback = {}) {
  const source = String(input?.source || fallback?.source || "").trim() || null;
  const externalId = String(input?.externalId || fallback?.externalId || "").trim() || null;
  const email = String(input?.email || fallback?.email || "").trim().toLowerCase() || null;
  const name = String(input?.name || fallback?.name || "").trim() || null;
  const userIdRaw = input?.userId ?? fallback?.userId;
  const userId = Number.isInteger(Number(userIdRaw)) && Number(userIdRaw) > 0 ? Number(userIdRaw) : null;

  let actorType = CampaignActorType.SYSTEM;
  if (userId) actorType = CampaignActorType.USER;
  else if (source || externalId || email || name) actorType = CampaignActorType.INTEGRATION;

  return {
    actorType,
    actorUserId: userId,
    actorExternalId: externalId,
    actorEmail: email,
    actorName: name,
    actorSource: source,
  };
}

export function buildLifecycleEventData({
  tenantId,
  campaignId,
  type,
  actor,
  reason = null,
  meta = null,
  createdAt = null,
}) {
  const normalizedActor = normalizeCampaignActor(actor);

  return {
    tenantId,
    campaignId: campaignId || undefined,
    type,
    actorType: normalizedActor.actorType,
    actorUserId: normalizedActor.actorUserId,
    actorExternalId: normalizedActor.actorExternalId,
    actorEmail: normalizedActor.actorEmail,
    actorName: normalizedActor.actorName,
    actorSource: normalizedActor.actorSource,
    reason: reason || null,
    meta: meta && typeof meta === "object" && Object.keys(meta).length ? meta : undefined,
    createdAt: createdAt || undefined,
  };
}

export function serializeLifecycleEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    actorExternalId: row.actorExternalId || null,
    actorEmail: row.actorEmail || null,
    actorName: row.actorName || null,
    actorSource: row.actorSource || null,
    reason: row.reason || null,
    meta: row.meta || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || null,
  };
}

export function serializeCampaignForIntegration(row) {
  if (!row) return null;

  const senderDomain = row?.senderIdentity?.senderDomain?.domain || "";
  const senderEmail = row?.senderIdentity?.localPart && senderDomain
    ? `${row.senderIdentity.localPart}@${senderDomain}`
    : "";

  const recipients = Array.isArray(row?.targetUsers) ? row.targetUsers : [];

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description || "",
    status: row.status,
    source: row.source || CampaignSource.UNKNOWN,
    targetType: row.targetType || CampaignTargetType.GROUP,
    postSubmitActionType: row.postSubmitActionType || CampaignPostSubmitActionType.TRAINING_PAGE,
    postSubmitRedirectUrl: row.postSubmitRedirectUrl || null,
    statusReason: row.statusReason || null,
    finishReason: row.finishReason || null,
    scheduledAt: row.scheduledAt?.toISOString?.() || row.scheduledAt || null,
    cutoffAt: row.cutoffAt?.toISOString?.() || row.cutoffAt || null,
    startedAt: row.startedAt?.toISOString?.() || row.startedAt || null,
    finishedAt: row.finishedAt?.toISOString?.() || row.finishedAt || null,
    cancelledAt: row.cancelledAt?.toISOString?.() || row.cancelledAt || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || null,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt || null,
    recipientCountSnapshot: Number(row.recipientCountSnapshot || recipients.length || 0),
    recipientsSent: recipients.filter((item) => item?.sentAt).length,
    recipientsDelivered: recipients.filter((item) => item?.delivered).length,
    recipientsOpened: recipients.filter((item) => item?.openedAt).length,
    recipientsClicked: recipients.filter((item) => item?.clickedAt).length,
    recipientsSubmitted: recipients.filter((item) => item?.submittedAt).length,
    recipientsReported: recipients.filter((item) => item?.reportedAt).length,
    package: row.package
      ? {
          id: row.package.id,
          name: row.package.name,
          description: row.package.description || "",
          category: row.package.category || "",
          language: row.package.language,
        }
      : null,
    emailTemplate: row.emailTemplate
      ? {
          id: row.emailTemplate.id,
          name: row.emailTemplate.name,
          subject: row.emailTemplate.subject,
          language: row.emailTemplate.language || row.package?.language || "CZ",
        }
      : null,
    landingPage: row.landingPage
      ? {
          id: row.landingPage.id,
          name: row.landingPage.name,
          urlSlug: row.landingPage.urlSlug,
          language: row.landingPage.language || row.package?.language || "CZ",
        }
      : null,
    senderIdentity: row.senderIdentity
      ? {
          id: row.senderIdentity.id,
          name: row.senderIdentity.name,
          fromName: row.senderIdentity.fromName,
          email: senderEmail,
          replyTo: row.senderIdentity.replyTo || senderEmail,
        }
      : null,
    targetGroup: row.targetGroup
      ? {
          id: row.targetGroup.id,
          name: row.targetGroup.name,
          description: row.targetGroup.description || "",
          memberCount: Number(row.targetGroup._count?.members || 0),
        }
      : null,
    lifecycleEvents: Array.isArray(row.lifecycleEvents)
      ? row.lifecycleEvents.map(serializeLifecycleEvent)
      : [],
  };
}

export function isCampaignInteractionWindowOpen(campaign, now = new Date()) {
  if (!campaign) return false;
  if (campaign.status !== CampaignStatus.RUNNING) return false;
  if (campaign.cancelledAt || campaign.finishedAt) return false;
  if (campaign.startedAt && now < new Date(campaign.startedAt)) return false;
  if (campaign.cutoffAt && now > new Date(campaign.cutoffAt)) return false;
  return true;
}

export function canCancelCampaign(status) {
  return [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED, CampaignStatus.RUNNING].includes(status);
}

export function buildCampaignName({ name, packageName, audienceName }) {
  const explicitName = String(name || "").trim();
  if (explicitName) return explicitName;

  const pkg = String(packageName || "").trim() || "Kampaň";
  const audience = String(audienceName || "").trim();
  return audience ? `${pkg} · ${audience}` : pkg;
}

export const CampaignLifecycle = {
  CampaignActorType,
  CampaignLifecycleEventType,
  CampaignPostSubmitActionType,
  CampaignSource,
  CampaignStatus,
  CampaignTargetType,
};
