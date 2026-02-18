// server/routes/recipients.js
import { Router } from "express";
import prisma from "../db/prisma.js";

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

  const firstName =
    body.firstName != null && String(body.firstName).trim() !== ""
      ? String(body.firstName).trim()
      : null;

  const lastName =
    body.lastName != null && String(body.lastName).trim() !== ""
      ? String(body.lastName).trim()
      : null;

  const fullNameRaw =
    body.fullName != null && String(body.fullName).trim() !== ""
      ? String(body.fullName).trim()
      : null;

  const fullName =
    fullNameRaw || `${firstName || ""} ${lastName || ""}`.trim() || null;

  const department =
    body.department != null && String(body.department).trim() !== ""
      ? String(body.department).trim()
      : null;

  const role =
    body.role != null && String(body.role).trim() !== ""
      ? String(body.role).trim()
      : null;

  // custom: jen custom1..custom20
  const rawCustom = body.custom && typeof body.custom === "object" ? body.custom : {};
  const custom = {};
  for (let i = 1; i <= 20; i++) {
    const k = `custom${i}`;
    const v = rawCustom[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") custom[k] = String(v);
  }

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
      if (typeof value === "object" && value !== null && "id" in value) tmp.push(Number(value.id));
      else tmp.push(Number(key));
    }
    groupIds = tmp;
  }

  const normalizedGroupIds = Array.from(
    new Set(
      (groupIds || [])
        .map((g) => {
          if (typeof g === "number" || typeof g === "string") return Number(g);
          if (g && typeof g === "object" && "id" in g) return Number(g.id);
          return NaN;
        })
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  return {
    email,
    firstName,
    lastName,
    fullName,
    department,
    role,
    custom: Object.keys(custom).length ? custom : null,
    groupIds: normalizedGroupIds,
  };
}

function domainOfEmail(email) {
  const s = String(email || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at <= 0) return null;
  return s.slice(at + 1);
}

async function assertRecipientEmailAllowed(tenantId, email) {
  // Backward compatible: pokud není nastaven žádný allowlist, neblokuj.
  const allowlistCount = await prisma.allowedRecipientDomain.count({
    where: { tenantId },
  });
  if (allowlistCount === 0) return;

  const domain = domainOfEmail(email);
  if (!domain) throw new Error("Invalid email address");

  const allowed = await prisma.allowedRecipientDomain.count({
    where: { tenantId, domain },
  });

  if (allowed === 0) {
    throw new Error(
      `Doména příjemce není povolená: ${domain}. Přidej ji v Settings → Recipient domains.`
    );
  }
}

function formatUser(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    department: row.department,
    role: row.role,
    custom: row.custom,
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

// GET /api/groups/:id/users?take=50&skip=0&q=...
router.get("/groups/:id/users", async (req, res) => {
  const groupId = Number(req.params.id);
  const take = Math.min(Number(req.query.take ?? 50) || 50, 200);
  const skip = Number(req.query.skip ?? 0) || 0;
  const q = String(req.query.q ?? "").trim().toLowerCase();

  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: "Invalid groupId" });
  }

  try {
    const tenantId = await getTenantId();

    const group = await prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Pozn.: recipients.js dnes pracuje hlavně s fullName.
    // Pokud máš v DB firstName/lastName, přidej je do OR (viz níže v části 2).
    const userFilter = {
      tenantId,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } },
              { department: { contains: q, mode: "insensitive" } },
              { role: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.groupMember.count({
        where: { groupId, user: userFilter },
      }),
      prisma.groupMember.findMany({
        where: { groupId, user: userFilter },
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
    return res.status(500).json({ error: e?.message || "Failed" });
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
    const { email, firstName, lastName, fullName, department, role, custom, groupIds } =
      normalizeUserInput(req.body || {});
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    await assertRecipientEmailAllowed(tenantId, email);
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
        firstName,
        lastName,
        fullName,
        department,
        role,
        custom,
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

// POST /api/users/import  { groupId, users:[{email,firstName,lastName,custom:{custom1..custom20}}] }
router.post("/users/import", async (req, res) => {
  const groupId = Number(req.body?.groupId);
  const users = req.body?.users;

  if (!Number.isInteger(groupId)) return res.status(400).json({ error: "groupId is required" });
  if (!Array.isArray(users)) return res.status(400).json({ error: "users must be an array" });

  try {
    const tenantId = await getTenantId();

    const group = await prisma.group.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true, name: true },
    });
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

        // respektuj allowlist (pokud je nastaven)
        await assertRecipientEmailAllowed(tenantId, email);

        // Minimálně fullName (kompatibilita s aktuálním schema.prisma v repu)
        const firstName = String(row?.firstName || "").trim();
        const lastName = String(row?.lastName || "").trim();
        const fullName = String(row?.fullName || "").trim() || `${firstName} ${lastName}`.trim() || null;

        // custom ignorujeme, dokud není v DB (viz část 2 níže)
        // Pokud custom v DB máš, doplň jeho uložení.

        // Pozor: v aktuálním schema.prisma je email @unique globálně.
        // Tady to držíme jednoduše pro demo tenant.
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true, tenantId: true },
        });

        let userId;

        if (!existing) {
          const created = await tx.user.create({
            data: {
              tenantId,
              email,
              fullName,
            },
            select: { id: true },
          });
          userId = created.id;
        } else {
          if (existing.tenantId !== tenantId) {
            skipped++;
            continue;
          }
          const updated = await tx.user.update({
            where: { id: existing.id },
            data: {
              fullName,
            },
            select: { id: true },
          });
          userId = updated.id;
        }

        await tx.groupMember.upsert({
          where: { userId_groupId: { userId, groupId } },
          create: { userId, groupId },
          update: {},
        });

        imported++;
      }
    });

    return res.json({ ok: true, imported, skipped });
  } catch (e) {
    console.error("POST /users/import failed", e);
    return res.status(500).json({ error: e?.message || "Failed" });
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

    const { email, firstName, lastName, fullName, department, role, custom, groupIds } =
      normalizeUserInput(req.body || {});

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    await assertRecipientEmailAllowed(tenantId, email);
    await prisma.groupMember.deleteMany({ where: { userId: id } });
    await prisma.user.update({
      where: { id },
      data: {
        email,
        firstName,
        lastName,
        fullName,
        department,
        role,
        custom,
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
