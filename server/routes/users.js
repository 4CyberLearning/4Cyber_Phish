// server/routes/users.js
import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

// stejně jako u šablon: jeden demo tenant
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

function normalizeUserInput(body = {}) {
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = body.fullName != null ? String(body.fullName).trim() : "";
  const department =
    body.department != null ? String(body.department).trim() : "";
  const role = body.role != null ? String(body.role).trim() : "";
  const groupIdsRaw = body.groupIds;

  let groupIds = [];
  if (Array.isArray(groupIdsRaw)) {
    groupIds = groupIdsRaw
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  return { email, fullName, department, role, groupIds };
}

/**
 * GET /api/users
 * – seznam uživatelů pro demo tenant
 * – vrací i přiřazené skupiny přes groupLinks.group
 */
router.get("/users", async (_req, res) => {
  try {
    const tenantId = await getTenantId();

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        groupLinks: {
          include: { group: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    console.error("GET /users failed", err);
    res.status(500).json({ error: err?.message || "Failed to load users" });
  }
});

/**
 * POST /api/users
 * body: { email, fullName?, department?, role?, groupIds?: number[] }
 */
router.post("/users", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const { email, fullName, department, role, groupIds } =
      normalizeUserInput(req.body || {});

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        fullName: fullName || null,
        department: department || null,
        role: role || null,
        groupLinks:
          groupIds && groupIds.length
            ? {
                create: groupIds.map((groupId) => ({ groupId })),
              }
            : undefined,
      },
      include: {
        groupLinks: { include: { group: true } },
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("POST /users failed", err);
    // typicky Unique constraint porušení
    res.status(500).json({ error: err?.message || "Failed to create user" });
  }
});

/**
 * PUT /api/users/:id
 * – update user + kompletní přepsání členství ve skupinách
 */
router.put("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const { email, fullName, department, role, groupIds } =
      normalizeUserInput(req.body || {});
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // update základních dat
    await prisma.user.update({
      where: { id },
      data: {
        email,
        fullName: fullName || null,
        department: department || null,
        role: role || null,
      },
    });

    // přepsání členství ve skupinách
    if (Array.isArray(groupIds)) {
      await prisma.groupMember.deleteMany({ where: { userId: id } });

      if (groupIds.length) {
        await prisma.groupMember.createMany({
          data: groupIds.map((groupId) => ({
            userId: id,
            groupId,
          })),
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        groupLinks: { include: { group: true } },
      },
    });

    res.json(user);
  } catch (err) {
    console.error("PUT /users/:id failed", err);
    res.status(500).json({ error: err?.message || "Failed to update user" });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /users/:id failed", err);
    res.status(500).json({ error: err?.message || "Failed to delete user" });
  }
});

/**
 * GET /api/groups
 * – vrací skupiny + _count.members
 */
router.get("/groups", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const groups = await prisma.group.findMany({
      where: { tenantId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(groups);
  } catch (err) {
    console.error("GET /groups failed", err);
    res.status(500).json({ error: err?.message || "Failed to load groups" });
  }
});

/**
 * POST /api/groups
 * body: { name }
 */
router.post("/groups", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Group name is required" });
  }

  try {
    const tenantId = await getTenantId();
    const group = await prisma.group.create({
      data: {
        tenantId,
        name,
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    res.status(201).json(group);
  } catch (err) {
    console.error("POST /groups failed", err);
    res.status(500).json({ error: err?.message || "Failed to create group" });
  }
});

/**
 * PUT /api/groups/:id – přejmenování
 */
router.put("/groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Group name is required" });
  }

  try {
    const tenantId = await getTenantId();
    const existing = await prisma.group.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Group not found" });
    }

    const group = await prisma.group.update({
      where: { id },
      data: { name },
      include: {
        _count: { select: { members: true } },
      },
    });

    res.json(group);
  } catch (err) {
    console.error("PUT /groups/:id failed", err);
    res.status(500).json({ error: err?.message || "Failed to update group" });
  }
});

/**
 * DELETE /api/groups/:id
 */
router.delete("/groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const tenantId = await getTenantId();
    const existing = await prisma.group.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Group not found" });
    }

    await prisma.group.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /groups/:id failed", err);
    res.status(500).json({ error: err?.message || "Failed to delete group" });
  }
});

export default router;
