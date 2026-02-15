// server/routes/recipientDomains.js
// Admin-only allowlist domén příjemců (bezpečnostní pojistka proti omylu).

import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

const DEFAULT_TENANT_SLUG = "demo";

function toClient(d) {
  if (!d) return d;
  // frontend jinde používá `description`, v DB je `label`
  return {
    ...d,
    description: d.label ?? null,
  };
}

async function getTenantId() {
  let tenant = await prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT_SLUG } });

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
  const labelRaw = body.label ?? body.description ?? null;
  const label = labelRaw ? String(labelRaw).trim() : null;

  if (!rawDomain) throw new Error("Doména je povinná.");

  // odstraň http(s)://, port, cestu
  rawDomain = rawDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:.+$/, "");

  if (!rawDomain.includes(".")) throw new Error("Neplatná doména.");

  return { domain: rawDomain, label };
}

// GET /api/recipient-domains
router.get("/recipient-domains", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const list = await prisma.allowedRecipientDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    res.json(list.map(toClient));
  } catch (err) {
    console.error("GET /api/recipient-domains error", err);
    res.status(500).json({ error: err?.message || "Failed to load recipient domains" });
  }
});

// POST /api/recipient-domains
router.post("/recipient-domains", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const input = normalizeDomainInput(req.body || {});

    const created = await prisma.allowedRecipientDomain.create({
      data: {
        tenantId,
        domain: input.domain,
        label: input.label,
      },
    });

    res.status(201).json(toClient(created));
  } catch (err) {
    console.error("POST /api/recipient-domains error", err);
    res.status(400).json({ error: err?.message || "Failed to create recipient domain" });
  }
});

// PUT /api/recipient-domains/:id
router.put("/recipient-domains/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await prisma.allowedRecipientDomain.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: "Recipient domain not found" });

    const input = normalizeDomainInput(req.body || {});

    const updated = await prisma.allowedRecipientDomain.update({
      where: { id },
      data: {
        domain: input.domain,
        label: input.label,
      },
    });

    res.json(toClient(updated));
  } catch (err) {
    console.error("PUT /api/recipient-domains/:id error", err);
    res.status(400).json({ error: err?.message || "Failed to update recipient domain" });
  }
});

// DELETE /api/recipient-domains/:id
router.delete("/recipient-domains/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await prisma.allowedRecipientDomain.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: "Recipient domain not found" });

    await prisma.allowedRecipientDomain.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/recipient-domains/:id error", err);
    res.status(500).json({ error: err?.message || "Failed to delete recipient domain" });
  }
});

export default router;