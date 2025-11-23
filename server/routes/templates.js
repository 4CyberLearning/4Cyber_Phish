// server/routes/templates.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Prozatím používáme jediného tenanta "demo"
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

/**
 * Normalizace vstupu z frontendu do tvaru, který očekává Prisma.
 * - tags: pole stringů (ze stringu "a,b,c" i z pole)
 * - difficulty: číslo (default 1)
 */
function normalizeTemplateInput(body = {}) {
  const {
    name = "",
    subject = "",
    bodyHtml = "",
    tags = [],
    difficulty,
  } = body;

  let tagsArr = [];

  if (Array.isArray(tags)) {
    tagsArr = tags.map(String).map((t) => t.trim()).filter(Boolean);
  } else if (typeof tags === "string") {
    tagsArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const difficultyNumber = Number.isFinite(Number(difficulty))
    ? Number(difficulty)
    : 1;

  return {
    name: String(name).trim(),
    subject: String(subject).trim(),
    bodyHtml: bodyHtml || "",
    tags: tagsArr,
    difficulty: difficultyNumber,
  };
}

// GET /api/templates – seznam šablon
router.get("/", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const templates = await prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  } catch (err) {
    console.error("GET /api/templates error", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// GET /api/templates/:id – detail šablony
router.get("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const template = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (err) {
    console.error("GET /api/templates/:id error", err);
    res.status(500).json({ error: "Failed to load template" });
  }
});

// POST /api/templates – vytvoření nové šablony
router.post("/", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const data = normalizeTemplateInput(req.body || {});

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const created = await prisma.emailTemplate.create({
      data: {
        tenantId,
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        tags: data.tags,
        difficulty: data.difficulty,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/templates error", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// PUT /api/templates/:id – úprava šablony
router.put("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const data = normalizeTemplateInput(req.body || {});

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        tags: data.tags,
        difficulty: data.difficulty,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/templates/:id error", err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// DELETE /api/templates/:id – smazání šablony
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

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
    const { to } = req.body || {};
    if (!to) {
      return res.status(400).json({ error: "Missing test email address" });
    }

    // TODO: napojit na utils/mailer.js / MailHog
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/templates/:id/send-test error", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
