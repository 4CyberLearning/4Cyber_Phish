// server/routes/landingPages.js
import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

// jeden demo tenant – stejně jako u templates
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

function rewriteUploadsToSameOrigin(html = "") {
  return String(html)
    // přepis libovolné absolutní URL na /uploads/... pokud vede na /uploads/
    .replace(/https?:\/\/[^/"']+\/uploads\//gi, "/uploads/");
}

function normalizeLandingInput(body = {}) {
  const { name = "", urlSlug = "", html = "", tags = [] } = body;

  let tagsArr = [];
  if (Array.isArray(tags)) {
    tagsArr = tags.map(String).map((t) => t.trim()).filter(Boolean);
  } else if (typeof tags === "string") {
    tagsArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const trimmedName = String(name).trim();

  const baseSlugSource = String(urlSlug || trimmedName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safeSlug = baseSlugSource || `lp-${Date.now()}`;

  return {
    name: trimmedName,
    urlSlug: safeSlug,
    html: rewriteUploadsToSameOrigin(html || ""),
    tags: tagsArr,
  };
}

// GET /api/landing-pages – seznam
router.get("/", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const pages = await prisma.landingPage.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    res.json(pages);
  } catch (err) {
    console.error("GET /api/landing-pages error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to load landing pages" });
  }
});

// GET /api/landing-pages/:id – detail
router.get("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const page = await prisma.landingPage.findFirst({
      where: { id, tenantId },
    });

    if (!page) {
      return res.status(404).json({ error: "Landing page not found" });
    }

    res.json(page);
  } catch (err) {
    console.error("GET /api/landing-pages/:id error", err);
    res.status(500).json({ error: "Failed to load landing page" });
  }
});

// POST /api/landing-pages – vytvoření
router.post("/", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const data = normalizeLandingInput(req.body || {});

    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const existingSlug = await prisma.landingPage.findUnique({
      where: { urlSlug: data.urlSlug },
    });
    if (existingSlug) {
      return res.status(400).json({ error: "Slug already exists" });
    }

    const created = await prisma.landingPage.create({
      data: {
        tenantId,
        name: data.name,
        urlSlug: data.urlSlug,
        html: data.html,
        tags: data.tags,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/landing-pages error", err);
    res.status(500).json({ error: "Failed to create landing page" });
  }
});

// PUT /api/landing-pages/:id – úprava
router.put("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.landingPage.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Landing page not found" });
    }

    const data = normalizeLandingInput(req.body || {});
    if (!data.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const slugOwner = await prisma.landingPage.findUnique({
      where: { urlSlug: data.urlSlug },
    });
    if (slugOwner && slugOwner.id !== id) {
      return res.status(400).json({ error: "Slug already exists" });
    }

    const updated = await prisma.landingPage.update({
      where: { id },
      data: {
        name: data.name,
        urlSlug: data.urlSlug,
        html: data.html,
        tags: data.tags,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/landing-pages/:id error", err);
    res.status(500).json({ error: "Failed to update landing page" });
  }
});

// DELETE /api/landing-pages/:id – smazání
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.landingPage.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Landing page not found" });
    }

    await prisma.landingPage.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/landing-pages/:id error", err);
    res.status(500).json({ error: "Failed to delete landing page" });
  }
});

export default router;
