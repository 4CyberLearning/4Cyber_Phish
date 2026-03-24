import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../db/prisma.js";
import { getTenantScope, PHISH_TENANT_SLUG } from "../utils/tenantScope.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const isDev = process.env.NODE_ENV !== "production";

  if (!email || !password) {
    if (isDev) console.log("LOGIN FAIL: missing email/password", { email, hasPassword: !!password });
    return res.status(400).json({ error: "Email and password required" });
  }

  let tenant;
  try {
    tenant = await getTenantScope({ allowCreate: false });
  } catch (error) {
    console.error(`LOGIN FAIL: tenant '${PHISH_TENANT_SLUG}' not found`, error);
    return res.status(500).json({ error: "Tenant not found" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      tenantId: tenant.id,
      isAdmin: true,
      isActive: true,
      passwordHash: { not: null },
    },
  });

  if (!user) {
    if (isDev) console.log("LOGIN FAIL: user not found/active/admin", { email: normalizedEmail, tenantId: tenant.id });
    return res.status(401).json({ error: isDev ? "User not found" : "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    if (isDev) console.log("LOGIN FAIL: wrong password", { userId: user.id, email: user.email });
    return res.status(401).json({ error: isDev ? "Wrong password" : "Invalid credentials" });
  }

  req.session.userId = user.id;
  req.session.tenantId = tenant.id;

  if (isDev) console.log("LOGIN OK", { userId: user.id, email: user.email, tenantSlug: tenant.slug });

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin },
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, fullName: true, isAdmin: true, isActive: true },
  });

  if (!user || !user.isActive || !user.isAdmin) {
    req.session.destroy(() => res.status(401).json({ error: "Not logged in" }));
    return;
  }

  res.json({ user });
});

export default router;
