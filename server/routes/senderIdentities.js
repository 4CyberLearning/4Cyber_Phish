// server/routes/senderIdentities.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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

function normalizeInput(body = {}) {
  const name = String(body.name || "").trim();
  const fromName = String(body.fromName || "").trim();
  const localPart = String(body.localPart || "").trim().toLowerCase();
  const senderDomainId = Number(body.senderDomainId);
  const replyTo = body.replyTo ? String(body.replyTo).trim() : null;
  const description = body.description ? String(body.description).trim() : null;
  const isDefault = Boolean(body.isDefault);

  if (!name || !fromName || !localPart || !senderDomainId) {
    throw new Error("Name, From name, local-part and domain are required");
  }

  if (localPart.includes("@")) {
    throw new Error("Local-part must not contain '@'");
  }

  return {
    name,
    fromName,
    localPart,
    senderDomainId,
    replyTo,
    description,
    isDefault,
  };
}

// GET /api/sender-identities
router.get("/sender-identities", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const list = await prisma.senderIdentity.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        senderDomain: true,
      },
    });
    res.json(list);
  } catch (err) {
    console.error("GET /api/sender-identities error", err);
    res.status(500).json({
      error: err?.message || "Failed to load sender identities",
    });
  }
});

// POST /api/sender-identities
router.post("/sender-identities", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const input = normalizeInput(req.body || {});

    const created = await prisma.$transaction(async (tx) => {
      const domain = await tx.senderDomain.findFirst({
        where: { id: input.senderDomainId, tenantId },
      });
      if (!domain) {
        throw new Error("Sender domain not found");
      }

      if (input.isDefault) {
        await tx.senderIdentity.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      return tx.senderIdentity.create({
        data: {
          tenantId,
          name: input.name,
          fromName: input.fromName,
          localPart: input.localPart,
          replyTo: input.replyTo,
          description: input.description,
          isDefault: input.isDefault,
          senderDomainId: input.senderDomainId,
        },
        include: { senderDomain: true },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/sender-identities error", err);
    res.status(400).json({
      error: err?.message || "Failed to create sender identity",
    });
  }
});

// PUT /api/sender-identities/:id
router.put("/sender-identities/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.senderIdentity.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sender identity not found" });
    }

    const input = normalizeInput(req.body || {});

    const updated = await prisma.$transaction(async (tx) => {
      const domain = await tx.senderDomain.findFirst({
        where: { id: input.senderDomainId, tenantId },
      });
      if (!domain) {
        throw new Error("Sender domain not found");
      }

      if (input.isDefault) {
        await tx.senderIdentity.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      return tx.senderIdentity.update({
        where: { id },
        data: {
          name: input.name,
          fromName: input.fromName,
          localPart: input.localPart,
          replyTo: input.replyTo,
          description: input.description,
          isDefault: input.isDefault,
          senderDomainId: input.senderDomainId,
        },
        include: { senderDomain: true },
      });
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/sender-identities/:id error", err);
    res.status(400).json({
      error: err?.message || "Failed to update sender identity",
    });
  }
});

// DELETE /api/sender-identities/:id
router.delete("/sender-identities/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.senderIdentity.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sender identity not found" });
    }

    await prisma.senderIdentity.delete({ where: { id } });

    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/sender-identities/:id error", err);
    res.status(500).json({
      error: err?.message || "Failed to delete sender identity",
    });
  }
});

export default router;
