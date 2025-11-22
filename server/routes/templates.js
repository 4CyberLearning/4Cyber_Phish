// server/routes/templates.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

const DEFAULT_TENANT_SLUG = "demo";

async function getTenantId() {
  // najdu tenant podle slugu; pokud neexistuje, vytvořím demo tenant
  let tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo tenant",
        slug: DEFAULT_TENANT_SLUG,
      },
    });
    console.log("Created demo tenant with id", tenant.id);
  }

  return tenant.id;
}

function normalizeTemplateInput(body) {
  const name = (body.name || "").trim();
  const subject = (body.subject || "").trim();
  const bodyHtml = body.bodyHtml || "";
  const tags = Array.isArray(body.tags)
    ? body.tags
    : typeof body.tags === "string"
    ? body.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const difficulty = Number(body.difficulty) || 1;

  return { name, subject, bodyHtml, tags, difficulty };
}

// GET /api/templates
router.get("/", async (_req, res) => {
  try {
    const tenantId = await getTenantId();

    const templates = await prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(templates);
  } catch (err) {
    console.error("GET /api/templates error", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// POST /api/templates
router.post("/", async (req, res) => {
  try {
    const data = normalizeTemplateInput(req.body);
    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const tenantId = await getTenantId();

    const created = await prisma.emailTemplate.create({
      data: { tenantId, ...data },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/templates error", err);

    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Template with this name already exists" });
    }

    res.status(500).json({
      error: "Failed to create template",
      detail: err?.message || String(err),
    });
  }
});

// PUT /api/templates/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = normalizeTemplateInput(req.body);
    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const tenantId = await getTenantId();

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/templates/:id error", err);
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Template with this name already exists" });
    }
    res.status(500).json({ error: "Failed to update template" });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = await getTenantId();

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    await prisma.emailTemplate.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/templates/:id error", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// POST /api/templates/:id/send-test – zatím jen stub
router.post("/:id/send-test", async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Missing test email address" });
    }
    // TODO: později napojíme na utils/mailer.js / MailHog
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/templates/:id/send-test error", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
