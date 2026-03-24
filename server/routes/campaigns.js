// server/routes/campaigns.js
import { Router } from "express";
import {
  CampaignLifecycleEventType,
  CampaignSource,
  CampaignStatus,
  CampaignTargetType,
} from "@prisma/client";
import prisma from "../db/prisma.js";
import { getTenantId } from "../utils/tenantScope.js";
import { sendCampaignNow } from "../services/campaignDispatch.js";
import {
  buildLifecycleEventData,
  campaignIntegrationInclude,
  canCancelCampaign,
  normalizeCampaignActor,
  parseDateOrNull,
} from "../services/campaignLifecycle.js";

const router = Router();

async function assertCampaignRefsBelongToTenant(tenantId, { emailTemplateId, landingPageId, senderIdentityId }) {
  const checks = [];

  if (emailTemplateId != null) {
    checks.push(
      prisma.emailTemplate.findFirst({
        where: { id: emailTemplateId, tenantId },
        select: { id: true },
      }),
    );
  } else {
    checks.push(Promise.resolve(true));
  }

  if (landingPageId != null) {
    checks.push(
      prisma.landingPage.findFirst({
        where: { id: landingPageId, tenantId },
        select: { id: true },
      }),
    );
  } else {
    checks.push(Promise.resolve(true));
  }

  if (senderIdentityId != null) {
    checks.push(
      prisma.senderIdentity.findFirst({
        where: { id: senderIdentityId, tenantId },
        select: { id: true },
      }),
    );
  } else {
    checks.push(Promise.resolve(true));
  }

  const [template, landingPage, senderIdentity] = await Promise.all(checks);

  if (emailTemplateId != null && !template) throw new Error("Email template not found");
  if (landingPageId != null && !landingPage) throw new Error("Landing page not found");
  if (senderIdentityId != null && !senderIdentity) throw new Error("Sender identity not found");
}

async function resolvePackageCampaignRefs(tenantId, packageId) {
  const pkg = await prisma.campaignPackage.findFirst({
    where: { id: packageId, tenantId },
    select: {
      id: true,
      emailTemplateId: true,
      landingPageId: true,
      senderIdentityId: true,
    },
  });

  if (!pkg) throw new Error("Package not found");

  return {
    packageId: pkg.id,
    emailTemplateId: pkg.emailTemplateId,
    landingPageId: pkg.landingPageId,
    senderIdentityId: pkg.senderIdentityId,
  };
}

function parseOptionalInt(value, key) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${key}`);
  }
  return n;
}

function normalizeLocalActor(input) {
  return normalizeCampaignActor(input, {
    source: "phish_local_admin",
  });
}

async function loadGroupWithRecipients(tx, tenantId, groupId) {
  const group = await tx.group.findFirst({
    where: { id: groupId, tenantId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              isActive: true,
              externalUserPublicId: true,
            },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!group) return null;

  const activeUsers = (group.members || [])
    .map((member) => member.user)
    .filter((user) => user?.id && user?.isActive);

  return { group, activeUsers };
}

async function replaceCampaignRecipientsFromGroup(tx, { tenantId, campaignId, groupId }) {
  const resolved = await loadGroupWithRecipients(tx, tenantId, groupId);
  if (!resolved) {
    throw new Error("Group not found");
  }

  if (!resolved.activeUsers.length) {
    throw new Error("Target group has no active recipients");
  }

  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      targetGroupId: groupId,
      targetType: CampaignTargetType.GROUP,
      recipientCountSnapshot: resolved.activeUsers.length,
      source: CampaignSource.LOCAL_ADMIN,
    },
  });

  await tx.campaignUser.deleteMany({ where: { campaignId } });

  await tx.campaignUser.createMany({
    data: resolved.activeUsers.map((user) => ({
      campaignId,
      userId: user.id,
      externalUserPublicId: user.externalUserPublicId || null,
    })),
    skipDuplicates: true,
  });

  return resolved;
}

function ensurpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63(body) {
  if (body?.userIds !== undefined) {
    return "userIds are no longer supported; use targetGroupId";
  }
  return null;
}

function validateLifecycleWindow(scheduledAt, cutoffAt) {
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduledAt");
  }
  if (!(cutoffAt instanceof Date) || Number.isNaN(cutoffAt.getTime())) {
    throw new Error("Invalid cutoffAt");
  }
  if (cutoffAt <= scheduledAt) {
    throw new Error("cutoffAt must be later than scheduledAt");
  }
}

async function resolveCampaignRefsForBody(tenantId, body) {
  let packageId = null;
  let emailTemplateId = null;
  let landingPageId = null;
  let senderIdentityId = null;

  if (body.packageId !== undefined && body.packageId !== null && body.packageId !== "") {
    const parsedPackageId = Number(body.packageId);
    if (!Number.isInteger(parsedPackageId) || parsedPackageId <= 0) {
      throw new Error("Invalid packageId");
    }

    const refs = await resolvePackageCampaignRefs(tenantId, parsedPackageId);
    packageId = refs.packageId;
    emailTemplateId = refs.emailTemplateId;
    landingPageId = refs.landingPageId;
    senderIdentityId = refs.senderIdentityId;
  } else {
    emailTemplateId =
      body.emailTemplateId !== undefined
        ? parseOptionalInt(body.emailTemplateId, "emailTemplateId")
        : undefined;
    landingPageId =
      body.landingPageId !== undefined
        ? parseOptionalInt(body.landingPageId, "landingPageId")
        : undefined;
    senderIdentityId =
      body.senderIdentityId !== undefined
        ? parseOptionalInt(body.senderIdentityId, "senderIdentityId")
        : undefined;

    await assertCampaignRefsBelongToTenant(tenantId, {
      emailTemplateId: emailTemplateId === undefined ? null : emailTemplateId,
      landingPageId: landingPageId === undefined ? null : landingPageId,
      senderIdentityId: senderIdentityId === undefined ? null : senderIdentityId,
    });
  }

  return {
    packageId,
    emailTemplateId,
    landingPageId,
    senderIdentityId,
  };
}

async function readCampaignOr404(tenantId, id, res) {
  const row = await prisma.campaign.findFirst({
    where: { id, tenantId },
    include: campaignAdminInclude,
  });

  if (!row) {
    res.status(404).json({ error: "Campaign not found" });
    return null;
  }

  return row;
}

// GET /api/campaigns – seznam kampaní
router.get("/campaigns", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const rows = await prisma.campaign.findMany({
      where: { tenantId },
      include: campaignAdminInclude,
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    });

    res.json(rows);
  } catch (error) {
    console.error("GET /campaigns failed", error);
    res.status(500).json({ error: error?.message || "Failed to load campaigns" });
  }
});

// GET /api/campaigns/:id – detail
router.get("/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const row = await readCampaignOr404(tenantId, id, res);
    if (!row) return;
    res.json(row);
  } catch (error) {
    console.error("GET /campaigns/:id failed", error);
    res.status(500).json({ error: error?.message || "Failed to load campaign" });
  }
});

// POST /api/campaigns/:id/targets/group
router.post("/campaigns/:id/targets/group", async (req, res) => {
  const campaignId = Number(req.params.id);
  const groupId = Number(req.body?.groupId);

  if (!Number.isInteger(campaignId) || campaignId <= 0 || !Number.isInteger(groupId) || groupId <= 0) {
    return res.status(400).json({ error: "Invalid campaignId/groupId" });
  }

  try {
    const tenantId = await getTenantId();
    const actor = normalizeLocalActor(req.body?.actor);
    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    await prisma.$transaction(async (tx) => {
      const resolved = await replaceCampaignRecipientsFromGroup(tx, {
        tenantId,
        campaignId,
        groupId,
      });

      await tx.campaignLifecycleEvent.create({
        data: buildLifecycleEventData({
          tenantId,
          campaignId,
          type: CampaignLifecycleEventType.UPDATED,
          actor,
          reason: "target_group_updated",
          meta: {
            targetGroupId: resolved.group.id,
            recipientCountSnapshot: resolved.activeUsers.length,
          },
        }),
      });
    });

    const row = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: campaignAdminInclude,
    });

    return res.json(row);
  } catch (error) {
    console.error("POST /campaigns/:id/targets/group failed", error);
    return res.status(500).json({ error: error?.message || "Failed to update target group" });
  }
});

// DELETE /api/campaigns/:id – smazání kampaně
router.delete("/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    await prisma.campaign.delete({ where: { id } });
    return res.status(204).end();
  } catch (error) {
    console.error("DELETE /campaigns/:id failed", error);
    res.status(500).json({ error: error?.message || "Failed to delete campaign" });
  }
});

// PATCH /api/campaigns/:id – průběžná konfigurace kampaně
router.patch("/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const removedTargetingError = ensurpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63(req.body);
  if (removedTargetingError) {
    return res.status(400).json({ error: removedTargetingError });
  }

  try {
    const tenantId = await getTenantId();
    const actor = normalizeLocalActor(req.body?.actor);

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        scheduledAt: true,
        cutoffAt: true,
        targetGroupId: true,
        packageId: true,
        emailTemplateId: true,
        landingPageId: true,
        senderIdentityId: true,
      },
    });

    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    const body = req.body || {};
    const updateData = {};
    const updatedFields = [];

    if (body.name !== undefined) {
      const value = String(body.name || "").trim();
      if (!value) return res.status(400).json({ error: "Name is required" });
      updateData.name = value;
      updatedFields.push("name");
    }

    if (body.description !== undefined) {
      updateData.description = String(body.description || "").trim() || null;
      updatedFields.push("description");
    }

    let nextScheduledAt = existing.scheduledAt;
    let nextCutoffAt = existing.cutoffAt;

    if (body.scheduledAt !== undefined) {
      nextScheduledAt = parseDateOrNull(body.scheduledAt);
      if (!(nextScheduledAt instanceof Date)) {
        return res.status(400).json({ error: "Invalid scheduledAt" });
      }
      updateData.scheduledAt = nextScheduledAt;
      updatedFields.push("scheduledAt");
    }

    if (body.cutoffAt !== undefined) {
      nextCutoffAt = parseDateOrNull(body.cutoffAt);
      if (!(nextCutoffAt instanceof Date)) {
        return res.status(400).json({ error: "Invalid cutoffAt" });
      }
      updateData.cutoffAt = nextCutoffAt;
      updatedFields.push("cutoffAt");
    }

    validateLifecycleWindow(nextScheduledAt, nextCutoffAt);

    const resolvedRefs = await resolveCampaignRefsForBody(tenantId, body);

    if (resolvedRefs.packageId !== undefined && body.packageId !== undefined) {
      updateData.packageId = resolvedRefs.packageId;
      updateData.emailTemplateId = resolvedRefs.emailTemplateId;
      updateData.landingPageId = resolvedRefs.landingPageId;
      updateData.senderIdentityId = resolvedRefs.senderIdentityId;
      updatedFields.push("packageId", "emailTemplateId", "landingPageId", "senderIdentityId");
    } else {
      if (resolvedRefs.emailTemplateId !== undefined) {
        updateData.emailTemplateId = resolvedRefs.emailTemplateId;
        updatedFields.push("emailTemplateId");
      }
      if (resolvedRefs.landingPageId !== undefined) {
        updateData.landingPageId = resolvedRefs.landingPageId;
        updatedFields.push("landingPageId");
      }
      if (resolvedRefs.senderIdentityId !== undefined) {
        updateData.senderIdentityId = resolvedRefs.senderIdentityId;
        updatedFields.push("senderIdentityId");
      }
    }

    const targetGroupId =
      body.targetGroupId !== undefined
        ? parseOptionalInt(body.targetGroupId, "targetGroupId")
        : undefined;

    if (!Object.keys(updateData).length && targetGroupId === undefined) {
      const row = await readCampaignOr404(tenantId, id, res);
      if (!row) return;
      return res.json(row);
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length) {
        await tx.campaign.update({
          where: { id },
          data: {
            ...updateData,
            source: CampaignSource.LOCAL_ADMIN,
          },
        });
      }

      if (targetGroupId !== undefined) {
        const resolved = await replaceCampaignRecipientsFromGroup(tx, {
          tenantId,
          campaignId: id,
          groupId: targetGroupId,
        });
        updatedFields.push("targetGroupId", "recipientCountSnapshot");
        updateData.targetGroupId = resolved.group.id;
        updateData.recipientCountSnapshot = resolved.activeUsers.length;
      }

      await tx.campaignLifecycleEvent.create({
        data: buildLifecycleEventData({
          tenantId,
          campaignId: id,
          type: CampaignLifecycleEventType.UPDATED,
          actor,
          reason: "campaign_updated",
          meta: {
            fields: [...new Set(updatedFields)],
          },
        }),
      });
    });

    const row = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: campaignAdminInclude,
    });

    res.json(row);
  } catch (error) {
    console.error("PATCH /campaigns/:id failed", error);
    res.status(500).json({ error: error?.message || "Failed to update campaign" });
  }
});

// POST /api/campaigns – vytvoření kampaně
router.post("/campaigns", async (req, res) => {
  const removedTargetingError = ensurpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63(req.body);
  if (removedTargetingError) {
    return res.status(400).json({ error: removedTargetingError });
  }

  try {
    const tenantId = await getTenantId();
    const actor = normalizeLocalActor(req.body?.actor);

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const scheduledAt = parseDateOrNull(req.body?.scheduledAt);
    const cutoffAt = parseDateOrNull(req.body?.cutoffAt);
    const targetGroupId = parseOptionalInt(req.body?.targetGroupId, "targetGroupId");

    validateLifecycleWindow(scheduledAt, cutoffAt);

    if (!targetGroupId) {
      return res.status(400).json({ error: "targetGroupId is required" });
    }

    const resolvedRefs = await resolveCampaignRefsForBody(tenantId, req.body || {});

    const created = await prisma.$transaction(async (tx) => {
      const resolvedGroup = await loadGroupWithRecipients(tx, tenantId, targetGroupId);
      if (!resolvedGroup) {
        throw new Error("Group not found");
      }
      if (!resolvedGroup.activeUsers.length) {
        throw new Error("Target group has no active recipients");
      }

      return tx.campaign.create({
        data: {
          tenantId,
          name,
          description: String(req.body?.description || "").trim() || null,
          scheduledAt,
          cutoffAt,
          status: CampaignStatus.SCHEDULED,
          source: CampaignSource.LOCAL_ADMIN,
          targetType: CampaignTargetType.GROUP,
          recipientCountSnapshot: resolvedGroup.activeUsers.length,
          packageId: resolvedRefs.packageId ?? null,
          emailTemplateId:
            resolvedRefs.emailTemplateId === undefined ? null : resolvedRefs.emailTemplateId,
          landingPageId:
            resolvedRefs.landingPageId === undefined ? null : resolvedRefs.landingPageId,
          senderIdentityId:
            resolvedRefs.senderIdentityId === undefined ? null : resolvedRefs.senderIdentityId,
          targetGroupId: resolvedGroup.group.id,
          targetUsers: {
            create: resolvedGroup.activeUsers.map((user) => ({
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
                reason: "created_via_local_admin",
                meta: {
                  targetGroupId: resolvedGroup.group.id,
                  recipientCountSnapshot: resolvedGroup.activeUsers.length,
                },
              }),
              buildLifecycleEventData({
                tenantId,
                type: CampaignLifecycleEventType.SCHEDULED,
                actor,
                reason: "scheduled_via_local_admin",
                meta: {
                  scheduledAt: scheduledAt.toISOString(),
                  cutoffAt: cutoffAt.toISOString(),
                },
              }),
            ],
          },
        },
        include: campaignAdminInclude,
      });
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("POST /campaigns failed", error);
    res.status(500).json({ error: error?.message || "Failed to create campaign" });
  }
});

// POST /api/campaigns/:id/send-now – okamžité odeslání kampaně
router.post("/campaigns/:id/send-now", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const actor = normalizeLocalActor(req.body?.actor);
    const result = await sendCampaignNow(id, tenantId, {
      source: CampaignSource.LOCAL_ADMIN,
      actor,
    });
    res.json(result);
  } catch (error) {
    console.error("POST /campaigns/:id/send-now failed", error);
    res.status(500).json({ error: error?.message || "Failed to send campaign" });
  }
});

// POST /api/campaigns/:id/cancel – ruční ukončení/stop kampaně
router.post("/campaigns/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const actor = normalizeLocalActor(req.body?.actor);
    const reason = String(req.body?.reason || "").trim() || "cancelled_via_local_admin";
    const now = new Date();

    const existing = await prisma.campaign.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!existing) return res.status(404).json({ error: "Campaign not found" });
    if (existing.status === CampaignStatus.CANCELLED) {
      const row = await readCampaignOr404(tenantId, id, res);
      if (!row) return;
      return res.json(row);
    }
    if (!canCancelCampaign(existing.status)) {
      return res.status(409).json({ error: "Campaign cannot be cancelled in current state" });
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.CANCELLED,
        cancelledAt: now,
        statusReason: reason,
        finishReason: reason,
        source: CampaignSource.LOCAL_ADMIN,
        lifecycleEvents: {
          create: buildLifecycleEventData({
            tenantId,
            type: CampaignLifecycleEventType.CANCELLED,
            actor,
            reason,
            meta: { previousStatus: existing.status },
            createdAt: now,
          }),
        },
      },
      include: campaignAdminInclude,
    });

    res.json(updated);
  } catch (error) {
    console.error("POST /campaigns/:id/cancel failed", error);
    res.status(500).json({ error: error?.message || "Failed to cancel campaign" });
  }
});

export default router;
