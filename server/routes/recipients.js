// server/routes/recipients.js
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Prozatím jediný tenant "demo"
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
  const fullName = body.fullName ? String(body.fullName).trim() : null;
  const department = body.department ? String(body.department).trim() : null;
  const role = body.role ? String(body.role).trim() : null;

  let groupIds = [];

  // 1) Standardní varianta: pole ID
  if (Array.isArray(body.groupIds)) {
    groupIds = body.groupIds;
  }

  // 2) Varianta: "groups" jako pole (ID nebo objekty { id, name })
  else if (Array.isArray(body.groups)) {
    groupIds = body.groups;
  }

  // 3) Varianta: "groups" jako mapa { "1": true, "2": false, ... }
  else if (body.groups && typeof body.groups === "object") {
    const tmp = [];
    for (const [key, value] of Object.entries(body.groups)) {
      if (!value) continue;
      // value může být true, nebo třeba { id: 1, name: "..." }
      if (typeof value === "object" && value !== null && "id" in value) {
        tmp.push(Number(value.id));
      } else {
        tmp.push(Number(key));
      }
    }
    groupIds = tmp;
  }

  // Finální normalizace: jen kladná celá čísla, bez duplicit
  const normalizedGroupIds = Array.from(
    new Set(
      (groupIds || [])
        .map((g) => {
          if (typeof g === "number" || typeof g === "string") {
            return Number(g);
          }
          if (g && typeof g === "object" && "id" in g) {
            return Number(g.id);
          }
          return NaN;
        })
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  return { email, fullName, department, role, groupIds: normalizedGroupIds };
}

function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    department: row.department,
    role: row.role,
    groups: (row.groupLinks || []).map((gm) => ({
      id: gm.groupId,
      name: gm.group?.name ?? "",
    })),
    createdAt: row.createdAt,
  };
}

/* ===== GROUPS ===== */

router.get("/groups", async (_req, res) => {
  try {
    const tenantId = await getTenantId();
    const groups = await prisma.group.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { members: true } },
      },
    });

    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g._count?.members ?? 0,
      }))
    );
  } catch (err) {
    console.error("GET /api/groups error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to load groups" });
  }
});

router.post("/groups", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const created = await prisma.group.create({
      data: { tenantId, name },
    });

    res.status(201).json({ id: created.id, name: created.name });
  } catch (err) {
    console.error("POST /api/groups error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to create group" });
  }
});

router.put("/groups/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const existing = await prisma.group.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Group not found" });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { name },
    });

    res.json({ id: updated.id, name: updated.name });
  } catch (err) {
    console.error("PUT /api/groups/:id error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to update group" });
  }
});

router.delete("/groups/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.group.findFirst({
      where: { id, tenantId },
      include: { members: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Odstraníme vazby na uživatele (uživatelé zůstanou "nezařazení")
    await prisma.groupMember.deleteMany({
      where: { groupId: id },
    });

    await prisma.group.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/groups/:id error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to delete group" });
  }
});

/* ===== USERS ===== */

router.get("/users", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const groupIdParam = req.query.groupId;
    let where = { tenantId };

    if (groupIdParam) {
      const groupId = Number(groupIdParam);
      if (Number.isInteger(groupId)) {
        where = {
          ...where,
          groupLinks: {
            some: { groupId },
          },
        };
      }
    }

    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        groupLinks: {
          include: { group: true },
        },
      },
    });

    res.json(rows.map(formatUser));
  } catch (err) {
    console.error("GET /api/users error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to load users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const { email, fullName, department, role, groupIds } =
      normalizeUserInput(req.body || {});

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const existing = await prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        fullName,
        department,
        role,
      },
    });

    if (groupIds.length > 0) {
      await prisma.groupMember.createMany({
        data: groupIds.map((groupId) => ({
          userId: user.id,
          groupId,
        })),
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        groupLinks: {
          include: { group: true },
        },
      },
    });

    res.status(201).json(formatUser(fullUser));
  } catch (err) {
    console.error("POST /api/users error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to create user" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

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

    await prisma.groupMember.deleteMany({ where: { userId: id } });

    await prisma.user.update({
      where: { id },
      data: {
        email,
        fullName,
        department,
        role,
      },
    });

    if (groupIds.length > 0) {
      await prisma.groupMember.createMany({
        data: groupIds.map((groupId) => ({
          userId: id,
          groupId,
        })),
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id },
      include: {
        groupLinks: {
          include: { group: true },
        },
      },
    });

    res.json(formatUser(fullUser));
  } catch (err) {
    console.error("PUT /api/users/:id error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const tenantId = await getTenantId();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/users/:id error", err);
    res
      .status(500)
      .json({ error: err?.message || "Failed to delete user" });
  }
});

export default router;
