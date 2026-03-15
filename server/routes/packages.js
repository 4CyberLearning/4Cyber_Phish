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

function normalizePackageInput(body = {}) {
  const name = String(body.name || "").trim();
  const description = body.description != null ? String(body.description).trim() : null;
  const category = body.category != null ? String(body.category).trim() : null;
  const previewText = body.previewText != null ? String(body.previewText).trim() : null;

  const difficultyRaw = body.difficulty ?? 1;
  const difficulty = Number(difficultyRaw);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error("Difficulty must be an integer between 1 and 5");
  }

  const emailTemplateId = Number(body.emailTemplateId);
  const landingPageId = Number(body.landingPageId);
  const senderIdentityId = Number(body.senderIdentityId);

  if (!Number.isInteger(emailTemplateId)) throw new Error("Invalid emailTemplateId");
  if (!Number.isInteger(landingPageId)) throw new Error("Invalid landingPageId");
  if (!Number.isInteger(senderIdentityId)) throw new Error("Invalid senderIdentityId");

  return {
    name,
    description: description || null,
    category: category || null,
    previewText: previewText || null,
    difficulty,
    isActive: body.isActive === false ? false : true,
    isApproved: body.isApproved === true,
    emailTemplateId,
    landingPageId,
    senderIdentityId,
  };
}

async function assertPackageRefsBelongToTenant(tx, tenantId, input) {
  const [template, landingPage, senderIdentity] = await Promise.all([
    tx.emailTemplate.findFirst({
      where: { id: input.emailTemplateId, tenantId },
      select: { id: true, name: true, subject: true },
    }),
    tx.landingPage.findFirst({
      where: { id: input.landingPageId, tenantId },
      select: { id: true, name: true, urlSlug: true },
    }),
    tx.senderIdentity.findFirst({
      where: { id: input.senderIdentityId, tenantId },
      select: {
        id: true,
        name: true,
        fromName: true,
        localPart: true,
        senderDomain: { select: { domain: true } },
      },
    }),
  ]);

  if (!template) throw new Error("Email template not found");
  if (!landingPage) throw new Error("Landing page not found");
  if (!senderIdentity) throw new Error("Sender identity not found");

  return { template, landingPage, senderIdentity };
}

function toPackageResponse(row) {
  const senderDomain = row?.senderIdentity?.senderDomain?.domain || "";
  const senderEmail =
    row?.senderIdentity?.localPart && senderDomain
      ? `${row.senderIdentity.localPart}@${senderDomain}`
      : "";

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    previewText: row.previewText,
    isActive: row.isActive,
    isApproved: row.isApproved,
    emailTemplateId: row.emailTemplateId,
    landingPageId: row.landingPageId,
    senderIdentityId: row.senderIdentityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    campaignsCount: row._count?.campaigns ?? 0,
    emailTemplate: row.emailTemplate
      ? {
          id: row.emailTemplate.id,
          name: row.emailTemplate.name,
          subject: row.emailTemplate.subject,
        }
      : null,
    landingPage: row.landingPage
      ? {
          id: row.landingPage.id,
          name: row.landingPage.name,
          urlSlug: row.landingPage.urlSlug,
        }
      : null,
    senderIdentity: row.senderIdentity
      ? {
          id: row.senderIdentity.id,
          name: row.senderIdentity.name,
          fromName: row.senderIdentity.fromName,
          email: senderEmail,
        }
      : null,
  };
}

router.get("/", async (_req, res) => {
  try {
    const tenantId = await getTenantId();

    const rows = await prisma.campaignPackage.findMany({
      where: { tenantId },
      orderBy: [{ isApproved: "desc" }, { isActive: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { campaigns: true } },
        emailTemplate: { select: { id: true, name: true, subject: true } },
        landingPage: { select: { id: true, name: true, urlSlug: true } },
        senderIdentity: {
          select: {
            id: true,
            name: true,
            fromName: true,
            localPart: true,
            senderDomain: { select: { domain: true } },
          },
        },
      },
    });

    res.json(rows.map(toPackageResponse));
  } catch (err) {
    console.error("GET /api/packages error", err);
    res.status(500).json({ error: err?.message || "Failed to load packages" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const row = await prisma.campaignPackage.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { campaigns: true } },
        emailTemplate: { select: { id: true, name: true, subject: true } },
        landingPage: { select: { id: true, name: true, urlSlug: true } },
        senderIdentity: {
          select: {
            id: true,
            name: true,
            fromName: true,
            localPart: true,
            senderDomain: { select: { domain: true } },
          },
        },
      },
    });

    if (!row) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json(toPackageResponse(row));
  } catch (err) {
    console.error("GET /api/packages/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to load package" });
  }
});

router.post("/", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const input = normalizePackageInput(req.body || {});

    if (!input.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const created = await prisma.$transaction(async (tx) => {
      await assertPackageRefsBelongToTenant(tx, tenantId, input);

      return tx.campaignPackage.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description,
          category: input.category,
          previewText: input.previewText,
          difficulty: input.difficulty,
          isActive: input.isActive,
          isApproved: input.isApproved,
          emailTemplateId: input.emailTemplateId,
          landingPageId: input.landingPageId,
          senderIdentityId: input.senderIdentityId,
        },
        include: {
          _count: { select: { campaigns: true } },
          emailTemplate: { select: { id: true, name: true, subject: true } },
          landingPage: { select: { id: true, name: true, urlSlug: true } },
          senderIdentity: {
            select: {
              id: true,
              name: true,
              fromName: true,
              localPart: true,
              senderDomain: { select: { domain: true } },
            },
          },
        },
      });
    });

    res.status(201).json(toPackageResponse(created));
  } catch (err) {
    console.error("POST /api/packages error", err);
    res.status(400).json({ error: err?.message || "Failed to create package" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const input = normalizePackageInput(req.body || {});

    if (!input.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.campaignPackage.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Package not found");
      }

      await assertPackageRefsBelongToTenant(tx, tenantId, input);

      return tx.campaignPackage.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          previewText: input.previewText,
          difficulty: input.difficulty,
          isActive: input.isActive,
          isApproved: input.isApproved,
          emailTemplateId: input.emailTemplateId,
          landingPageId: input.landingPageId,
          senderIdentityId: input.senderIdentityId,
        },
        include: {
          _count: { select: { campaigns: true } },
          emailTemplate: { select: { id: true, name: true, subject: true } },
          landingPage: { select: { id: true, name: true, urlSlug: true } },
          senderIdentity: {
            select: {
              id: true,
              name: true,
              fromName: true,
              localPart: true,
              senderDomain: { select: { domain: true } },
            },
          },
        },
      });
    });

    res.json(toPackageResponse(updated));
  } catch (err) {
    console.error("PUT /api/packages/:id error", err);
    res.status(400).json({ error: err?.message || "Failed to update package" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.campaignPackage.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Package not found" });
    }

    const used = await prisma.campaign.count({
      where: { tenantId, packageId: id },
    });

    if (used > 0) {
      return res.status(409).json({
        error: "Package is already used in one or more campaigns",
      });
    }

    await prisma.campaignPackage.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/packages/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to delete package" });
  }
});

export default router;