// server/routes/users.js
import { Router } from "express";
import prisma from "../db/prisma.js";

const router = Router();

// stejně jako u šablon: jeden demo tenant
const DEFAULT_TENANT_SLUG = "demo";
const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  fullName: true,
  department: true,
  role: true,
  isAdmin: true,
  createdAt: true,
  groupLinks: {
    select: {
      groupId: true,
      group: { select: { id: true, name: true } },
    },
  },
};

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
      select: USER_PUBLIC_SELECT,
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
            ? { create: groupIds.map((groupId) => ({ groupId })) }
            : undefined,
      },
      select: USER_PUBLIC_SELECT,
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
      select: USER_PUBLIC_SELECT,
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

// GET /api/groups/:id/users?take=50&skip=0&q=...
router.get("/groups/:id/users", async (req, res) => {
  const groupId = Number(req.params.id);
  const take = Math.min(Number(req.query.take ?? 50) || 50, 200);
  const skip = Number(req.query.skip ?? 0) || 0;
  const q = String(req.query.q ?? "").trim().toLowerCase();

  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "Invalid groupId" });

  try {
    const tenantId = await getTenantId();

    const group = await prisma.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    const whereUser = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.groupMember.count({ where: { groupId, user: whereUser } }),
      prisma.groupMember.findMany({
        where: { groupId, user: whereUser },
        orderBy: { joinedAt: "desc" },
        skip,
        take,
        select: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              fullName: true,
              department: true,
              role: true,
              custom: true,
            },
          },
        },
      }),
    ]);

    return res.json({ total, items: items.map((x) => x.user) });
  } catch (e) {
    console.error("GET /groups/:id/users failed", e);
    return res.status(500).json({ error: e.message || "Failed" });
  }
});

// POST /api/users/import  { groupId, users:[{email,firstName,lastName,custom:{custom1..custom20}}] }
router.post("/users/import", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  const users = req.body?.users;

  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId is required" });
  if (!Array.isArray(users)) return res.status(400).json({ error: "users must be an array" });

  try {
    const tenantId = await getTenantId();

    const group = await prisma.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } });
    if (!group) return res.status(404).json({ error: "Group not found" });

    let imported = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of users) {
        const email = String(row?.email || "").trim().toLowerCase();
        if (!email) {
          skipped++;
          continue;
        }

        const firstName = String(row?.firstName || "").trim() || null;
        const lastName = String(row?.lastName || "").trim() || null;

        const fullName =
          (String(firstName || "") + " " + String(lastName || "")).trim() || null;

        // custom: jen custom1..custom20
        const rawCustom = row?.custom && typeof row.custom === "object" ? row.custom : {};
        const custom = {};
        for (let i = 1; i <= 20; i++) {
          const k = `custom${i}`;
          const v = rawCustom?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") custom[k] = String(v);
        }

        const user = await tx.user.upsert({
          where: { email },
          create: {
            tenantId,
            email,
            firstName,
            lastName,
            fullName,
            custom: Object.keys(custom).length ? custom : null,
          },
          update: {
            firstName,
            lastName,
            fullName,
            custom: Object.keys(custom).length ? custom : null,
          },
          select: { id: true },
        });

        await tx.groupMember.upsert({
          where: { userId_groupId: { userId: user.id, groupId } },
          create: { userId: user.id, groupId },
          update: {},
        });

        imported++;
      }
    });

    return res.json({ ok: true, imported, skipped });
  } catch (e) {
    console.error("POST /users/import failed", e);
    return res.status(500).json({ error: e.message || "Failed" });
  }
});

export default router;
