// server/routes/senderDomains.js
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

function normalizeDomainInput(body = {}) {
  let rawDomain = String(body.domain || "").trim().toLowerCase();
  const label = body.label ? String(body.label).trim() : null;
  const isDefault = Boolean(body.isDefault);

  if (!rawDomain) {
    throw new Error("Doména je povinná.");
  }

  // odstraň http(s)://, port, cestu
  rawDomain = rawDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:.+$/, "");

  if (!rawDomain.includes(".")) {
    throw new Error("Neplatná doména.");
  }

  return { domain: rawDomain, label, isDefault };
}

// GET /api/sender-domains
router.get("/sender-domains", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const list = await prisma.senderDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    res.json(list);
  } catch (err) {
    console.error("GET /api/sender-domains error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to load sender domains" });
  }
});

// POST /api/sender-domains
router.post("/sender-domains", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const input = normalizeDomainInput(req.body || {});

    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.senderDomain.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }
      return tx.senderDomain.create({
        data: {
          tenantId,
          domain: input.domain,
          label: input.label,
          isDefault: input.isDefault,
        },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/sender-domains error", err);
    res.status(400).json({
      error: err?.message || "Failed to create sender domain",
    });
  }
});

// PUT /api/sender-domains/:id
router.put("/sender-domains/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.senderDomain.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sender domain not found" });
    }

    const input = normalizeDomainInput(req.body || {});

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.senderDomain.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }
      return tx.senderDomain.update({
        where: { id },
        data: {
          domain: input.domain,
          label: input.label,
          isDefault: input.isDefault,
        },
      });
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/sender-domains/:id error", err);
    res.status(400).json({
      error: err?.message || "Failed to update sender domain",
    });
  }
});

// DELETE /api/sender-domains/:id
router.delete("/sender-domains/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.senderDomain.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sender domain not found" });
    }

    // volitelné: zakázat smazání, pokud má identity
    const identitiesCount = await prisma.senderIdentity.count({
      where: { senderDomainId: id, tenantId },
    });
    if (identitiesCount > 0) {
      return res.status(400).json({
        error:
          "Doména je použita v odesílacích identitách. Nejprve je prosím změň nebo smaž.",
      });
    }

    await prisma.senderDomain.delete({ where: { id } });

    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/sender-domains/:id error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to delete sender domain" });
  }
});

export default router;
