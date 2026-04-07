import express from "express";
import {
  CampaignLifecycleEventType,
  CampaignPostSubmitActionType,
  CampaignSource,
  CampaignStatus,
  CampaignTargetType,
} from "@prisma/client";
import prisma from "../db/prisma.js";
import {
  buildCampaignName,
  buildLifecycleEventData,
  campaignIntegrationInclude,
  canCancelCampaign,
  normalizeCampaignActor,
  parseDateOrNull,
  serializeCampaignForIntegration,
} from "../services/campaignLifecycle.js";

const router = express.Router();

function serializeGroup(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    memberCount: Number(group._count?.members || group.members?.length || 0),
    memberUserPublicIds: (group.members || [])
      .map((member) => member?.user?.externalUserPublicId || null)
      .filter(Boolean),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function serializePackageForIntegration(row) {
  const senderDomain = row?.senderIdentity?.senderDomain?.domain || "";
  const senderEmail =
    row?.senderIdentity?.localPart && senderDomain
      ? `${row.senderIdentity.localPart}@${senderDomain}`
      : "";

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category || "",
    language: row.language,
    previewText: row.previewText || "",
    isActive: row.isActive,
    isApproved: row.isApproved,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    emailTemplate: row.emailTemplate
      ? {
          id: row.emailTemplate.id,
          name: row.emailTemplate.name,
          subject: row.emailTemplate.subject,
          bodyHtml: row.emailTemplate.bodyHtml || "",
        }
      : null,
    landingPage: row.landingPage
      ? {
          id: row.landingPage.id,
          name: row.landingPage.name,
          urlSlug: row.landingPage.urlSlug,
          html: row.landingPage.html || "",
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
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function compactString(value) {
  const s = String(value || "").trim();
  return s || null;
}

function buildFullName(firstName, lastName, email) {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || email;
}


function normalizeAbsoluteHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function resolvePostSubmitConfig(body = {}, fallback = {}) {
  const rawType = body.postSubmitActionType ?? fallback.postSubmitActionType ?? CampaignPostSubmitActionType.TRAINING_PAGE;
  const actionType = Object.values(CampaignPostSubmitActionType).includes(rawType)
    ? rawType
    : null;

  if (!actionType) {
    throw new Error("Invalid postSubmitActionType");
  }

  const redirectUrl = normalizeAbsoluteHttpUrl(
    body.postSubmitRedirectUrl ?? fallback.postSubmitRedirectUrl ?? null
  );

  if (actionType === CampaignPostSubmitActionType.REDIRECT_URL && !redirectUrl) {
    throw new Error("postSubmitRedirectUrl is required for REDIRECT_URL");
  }

  return {
    postSubmitActionType: actionType,
    postSubmitRedirectUrl:
      actionType === CampaignPostSubmitActionType.REDIRECT_URL ? redirectUrl : null,
  };
}


// PUT /api/integration/recipients
// PUT /api/integration/recipients
router.put("/recipients", async (req, res) => {
  const tenantId = req.integration?.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

  const fullSync = !!req.body?.fullSync;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const normalized = [];
  for (const it of items) {
    const userPublicId = String(it?.userPublicId || "").trim();
    const email = String(it?.email || "").trim().toLowerCase();
    const firstName = compactString(it?.name);
    const lastName = compactString(it?.surname);
    const isActive = it?.isActive === false ? false : true;

    if (!isUuid(userPublicId) || !email) continue;

    normalized.push({
      userPublicId,
      email,
      firstName,
      lastName,
      isActive,
    });
  }

  const seenPublicIds = new Set();
  const keepPublicIds = [];
  const conflictItems = [];

  let upserted = 0;
  let campaignUsersUpdated = 0;
  let conflicts = 0;

  for (const u of normalized) {
    if (seenPublicIds.has(u.userPublicId)) continue;
    seenPublicIds.add(u.userPublicId);
    keepPublicIds.push(u.userPublicId);

    const byPublicId = await prisma.user.findFirst({
      where: { tenantId, externalUserPublicId: u.userPublicId },
      select: { id: true, email: true, externalUserPublicId: true },
    });

    const byEmail = await prisma.user.findFirst({
      where: { tenantId, email: u.email },
      select: { id: true, email: true, externalUserPublicId: true },
    });

    if (byPublicId && byEmail && byPublicId.id !== byEmail.id) {
      conflicts += 1;
      conflictItems.push({
        userPublicId: u.userPublicId,
        email: u.email,
        reason: "email_bound_to_other_user",
      });
      continue;
    }

    const target = byPublicId || byEmail;

    const data = {
      email: u.email,
      externalUserPublicId: u.userPublicId,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: buildFullName(u.firstName, u.lastName, u.email),
      isActive: u.isActive,
    };

    const user = target
      ? await prisma.user.update({
          where: { id: target.id },
          data,
          select: { id: true },
        })
      : await prisma.user.create({
          data: {
            tenantId,
            ...data,
          },
          select: { id: true },
        });

    upserted += 1;

    const r = await prisma.campaignUser.updateMany({
      where: {
        userId: user.id,
        OR: [
          { externalUserPublicId: null },
          { externalUserPublicId: { not: u.userPublicId } },
        ],
      },
      data: { externalUserPublicId: u.userPublicId },
    });

    campaignUsersUpdated += r.count;
  }

  let deactivated = 0;
  if (fullSync) {
    const r = await prisma.user.updateMany({
      where: {
        tenantId,
        isActive: true,
        AND: [
          { externalUserPublicId: { not: null } },
          { externalUserPublicId: { notIn: keepPublicIds } },
        ],
      },
      data: { isActive: false },
    });
    deactivated = r.count;
  }

  res.json({
    ok: true,
    tenantId,
    fullSync,
    received: items.length,
    valid: normalized.length,
    upserted,
    deactivated,
    campaignUsersUpdated,
    conflicts,
    conflictItems,
  });
});

router.get("/groups", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const groups = await prisma.group.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { externalUserPublicId: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    res.json({ items: groups.map(serializeGroup) });
  } catch (err) {
    console.error("GET /api/integration/groups error", err);
    res.status(500).json({ error: err?.message || "Failed to load groups" });
  }
});

router.post("/groups", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!name) return res.status(400).json({ error: "Group name is required" });

    const created = await prisma.group.create({
      data: { tenantId, name, description: description || null },
      include: {
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { externalUserPublicId: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    res.status(201).json(serializeGroup(created));
  } catch (err) {
    console.error("POST /api/integration/groups error", err);
    res.status(500).json({ error: err?.message || "Failed to create group" });
  }
});

router.put("/groups/:id", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!name) return res.status(400).json({ error: "Group name is required" });

    const existing = await prisma.group.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "Group not found" });

    const updated = await prisma.group.update({
      where: { id },
      data: { name, description: description || null },
      include: {
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { externalUserPublicId: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    res.json(serializeGroup(updated));
  } catch (err) {
    console.error("PUT /api/integration/groups/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to update group" });
  }
});

router.delete("/groups/:id", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await prisma.group.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "Group not found" });

    await prisma.groupMember.deleteMany({ where: { groupId: id } });
    await prisma.group.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/integration/groups/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to delete group" });
  }
});

router.post("/groups/:id/members", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const groupId = Number(req.params.id);
    const userPublicId = String(req.body?.userPublicId || "").trim();
    if (!Number.isInteger(groupId) || !userPublicId) return res.status(400).json({ error: "Invalid input" });

    const [group, user] = await Promise.all([
      prisma.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } }),
      prisma.user.findFirst({ where: { tenantId, externalUserPublicId: userPublicId }, select: { id: true } }),
    ]);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId: user.id, groupId } },
      update: {},
      create: { userId: user.id, groupId },
    });

    const updated = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { externalUserPublicId: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    res.json(serializeGroup(updated));
  } catch (err) {
    console.error("POST /api/integration/groups/:id/members error", err);
    res.status(500).json({ error: err?.message || "Failed to add member" });
  }
});

router.delete("/groups/:id/members/:userPublicId", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const groupId = Number(req.params.id);
    const userPublicId = String(req.params.userPublicId || "").trim();
    if (!Number.isInteger(groupId) || !userPublicId) return res.status(400).json({ error: "Invalid input" });

    const [group, user] = await Promise.all([
      prisma.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } }),
      prisma.user.findFirst({ where: { tenantId, externalUserPublicId: userPublicId }, select: { id: true } }),
    ]);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.groupMember.deleteMany({ where: { groupId, userId: user.id } });

    const updated = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
        members: {
          select: { user: { select: { externalUserPublicId: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    res.json(serializeGroup(updated));
  } catch (err) {
    console.error("DELETE /api/integration/groups/:id/members/:userPublicId error", err);
    res.status(500).json({ error: err?.message || "Failed to remove member" });
  }
});

router.get("/packages", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const rows = await prisma.campaignPackage.findMany({
      where: { tenantId, isActive: true, isApproved: true },
      orderBy: [{ language: "asc" }, { name: "asc" }],
      include: {
      emailTemplate: {
        select: {
          id: true,
          name: true,
          subject: true,
          bodyHtml: true,
          language: true,
        },
      },
      landingPage: {
        select: {
          id: true,
          name: true,
          urlSlug: true,
          html: true,
          language: true,
        },
      },
      senderIdentity: {
        select: {
          id: true,
          name: true,
          fromName: true,
          localPart: true,
          replyTo: true,
          senderDomain: { select: { domain: true } },
        },
      },
      },
    });

    res.json({ items: rows.map(serializePackageForIntegration) });
  } catch (err) {
    console.error("GET /api/integration/packages error", err);
    res.status(500).json({ error: err?.message || "Failed to load packages" });
  }
});

router.get("/packages/:id", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await prisma.campaignPackage.findFirst({
      where: { id, tenantId, isActive: true, isApproved: true },
      include: {
      emailTemplate: {
        select: {
          id: true,
          name: true,
          subject: true,
          bodyHtml: true,
        },
      },
      landingPage: {
        select: {
          id: true,
          name: true,
          urlSlug: true,
          html: true,
        },
      },
      senderIdentity: {
        select: {
          id: true,
          name: true,
          fromName: true,
          localPart: true,
          replyTo: true,
          senderDomain: { select: { domain: true } },
        },
      },
      },
    });

    if (!row) return res.status(404).json({ error: "Package not found" });
    res.json(serializePackageForIntegration(row));
  } catch (err) {
    console.error("GET /api/integration/packages/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to load package" });
  }
});

router.get("/campaigns", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const items = await prisma.campaign.findMany({
      where: { tenantId },
      include: campaignIntegrationInclude,
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      take: 100,
    });

    res.json({ items: items.map(serializeCampaignForIntegration) });
  } catch (err) {
    console.error("GET /api/integration/campaigns error", err);
    res.status(500).json({ error: err?.message || "Failed to load campaigns" });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const row = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: campaignIntegrationInclude,
    });

    if (!row) return res.status(404).json({ error: "Campaign not found" });
    res.json(serializeCampaignForIntegration(row));
  } catch (err) {
    console.error("GET /api/integration/campaigns/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to load campaign" });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const packageId = Number(req.body?.packageId);
    const scheduledAt = parseDateOrNull(req.body?.scheduledAt);
    const cutoffAt = parseDateOrNull(req.body?.cutoffAt);
    const targetGroupId = req.body?.targetGroupId != null && req.body?.targetGroupId !== ""
      ? Number(req.body.targetGroupId)
      : null;
    const description = String(req.body?.description || "").trim() || null;
    const audienceName = String(req.body?.audienceName || "").trim() || null;
    const actor = normalizeCampaignActor(req.body?.actor, {
      source: "city_integration",
    });
    const postSubmit = resolvePostSubmitConfig(req.body);
    console.log("POST /api/integration/campaigns body =", JSON.stringify(req.body));
    
    if (!Number.isInteger(packageId) || packageId <= 0) return res.status(400).json({ error: "Invalid packageId" });
    if (!(scheduledAt instanceof Date)) return res.status(400).json({ error: "Invalid scheduledAt" });
    if (!(cutoffAt instanceof Date)) return res.status(400).json({ error: "Invalid cutoffAt" });
    if (cutoffAt <= scheduledAt) return res.status(400).json({ error: "cutoffAt must be later than scheduledAt" });
    if (!Number.isInteger(targetGroupId) || targetGroupId <= 0) return res.status(400).json({ error: "Invalid targetGroupId" });

    const [pkg, targetGroup] = await Promise.all([
      prisma.campaignPackage.findFirst({
        where: { id: packageId, tenantId, isActive: true, isApproved: true },
        select: {
          id: true,
          name: true,
          description: true,
          emailTemplateId: true,
          landingPageId: true,
          senderIdentityId: true,
        },
      }),
      prisma.group.findFirst({
        where: { id: targetGroupId, tenantId },
        include: {
          members: {
            include: { user: true },
          },
          _count: { select: { members: true } },
        },
      }),
    ]);

    if (!pkg) return res.status(404).json({ error: "Package not found" });
    if (!targetGroup) return res.status(404).json({ error: "Group not found" });

    const users = (targetGroup.members || [])
      .map((item) => item.user)
      .filter((user) => user?.id && user?.isActive);

    if (!users.length) {
      return res.status(400).json({ error: "Target group has no active recipients" });
    }

    const created = await prisma.campaign.create({
      data: {
        tenantId,
        name: buildCampaignName({
          name: req.body?.name,
          packageName: pkg.name,
          audienceName,
        }),
        description: description || pkg.description || null,
        scheduledAt,
        cutoffAt,
        status: CampaignStatus.SCHEDULED,
        source: CampaignSource.INTEGRATION,
        targetType: CampaignTargetType.GROUP,
        recipientCountSnapshot: users.length,
        postSubmitActionType: postSubmit.postSubmitActionType,
        postSubmitRedirectUrl: postSubmit.postSubmitRedirectUrl,
        packageId: pkg.id,
        emailTemplateId: pkg.emailTemplateId,
        landingPageId: pkg.landingPageId,
        senderIdentityId: pkg.senderIdentityId,
        targetGroupId: targetGroup.id,
        targetUsers: {
          create: users.map((user) => ({
            userId: user.id,
            externalUserPublicId: user.externalUserPublicId || null,
          })),
        },
        lifecycleEvents: {
          create: [
            buildLifecycleEventData({
              tenantId,
              type: CampaignLifecycleEventType.CREATED,
              actor,
              reason: "created_via_integration",
              meta: {
                packageId: pkg.id,
                targetGroupId: targetGroup.id,
                recipientCountSnapshot: users.length,
                postSubmitActionType: postSubmit.postSubmitActionType,
                postSubmitRedirectUrl: postSubmit.postSubmitRedirectUrl,
              },
            }),
            buildLifecycleEventData({
              tenantId,
              type: CampaignLifecycleEventType.SCHEDULED,
              actor,
              reason: "scheduled_via_integration",
              meta: {
                scheduledAt: scheduledAt.toISOString(),
                cutoffAt: cutoffAt.toISOString(),
                postSubmitActionType: postSubmit.postSubmitActionType,
                postSubmitRedirectUrl: postSubmit.postSubmitRedirectUrl,
              },
            }),
          ],
        },
      },
      include: campaignIntegrationInclude,
    });

    res.status(201).json(serializeCampaignForIntegration(created));
  } catch (err) {
    console.error("POST /api/integration/campaigns error", err);
    res.status(500).json({ error: err?.message || "Failed to create campaign" });
  }
});

router.post("/campaigns/:id/cancel", async (req, res) => {
  try {
    const tenantId = req.integration?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

    const actor = normalizeCampaignActor(req.body?.actor, {
      source: "city_integration",
    });
    const postSubmit = resolvePostSubmitConfig(req.body);
    const reason = String(req.body?.reason || "").trim() || "cancelled_via_integration";
    const now = new Date();

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: campaignIntegrationInclude,
    });

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status === CampaignStatus.CANCELLED) {
      return res.json(serializeCampaignForIntegration(campaign));
    }
    if (!canCancelCampaign(campaign.status)) {
      return res.status(409).json({ error: "Campaign cannot be cancelled in current state" });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.CANCELLED,
        cancelledAt: now,
        statusReason: reason,
        finishReason: reason,
        source: CampaignSource.INTEGRATION,
        lifecycleEvents: {
          create: buildLifecycleEventData({
            tenantId,
            type: CampaignLifecycleEventType.CANCELLED,
            actor,
            reason,
            meta: { previousStatus: campaign.status },
            createdAt: now,
          }),
        },
      },
      include: campaignIntegrationInclude,
    });

    res.json(serializeCampaignForIntegration(updated));
  } catch (err) {
    console.error("POST /api/integration/campaigns/:id/cancel error", err);
    res.status(500).json({ error: err?.message || "Failed to cancel campaign" });
  }
});

router.get("/ping", async (req, res) => {
  const tenantId = req.integration?.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

  res.json({
    ok: true,
    tenantId,
    service: "4CyberPhish",
  });
});

export default router;
