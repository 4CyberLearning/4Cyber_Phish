// server/routes/integration.js
import express from "express";
import prisma from "../db/prisma.js";

const router = express.Router();

// PUT /api/integration/recipients
// body: { fullSync?: boolean, items: [{ userPublicId, email, isActive? }] }
router.put("/recipients", async (req, res) => {
  const tenantId = req.integration?.tenantId;
  if (!tenantId) return res.status(401).json({ error: "Missing tenant scope" });

  const fullSync = !!req.body?.fullSync;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  // basic validation
  const normalized = [];
  for (const it of items) {
    const userPublicId = String(it?.userPublicId || "").trim();
    const email = String(it?.email || "").trim().toLowerCase();
    const isActive = it?.isActive === false ? false : true;

    if (!userPublicId || !email) continue;
    normalized.push({ userPublicId, email, isActive });
  }

  // upsert users by (tenantId,email) and set externalUserPublicId + isActive
  const seenEmails = new Set();
  let upserted = 0;
  let campaignUsersUpdated = 0;

  for (const u of normalized) {
    if (seenEmails.has(u.email)) continue;
    seenEmails.add(u.email);

    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: u.email } }, // uses @@unique([tenantId,email])
      update: {
        externalUserPublicId: u.userPublicId,
        isActive: u.isActive,
      },
      create: {
        tenantId,
        email: u.email,
        externalUserPublicId: u.userPublicId,
        isActive: u.isActive,
        // ostatní pole nech prázdná – login účty řešíš jinde
      },
      select: { id: true },
    });

    upserted += 1;

    // backfill to campaignUser so reports/users starts working immediately
    const r = await prisma.campaignUser.updateMany({
      where: { userId: user.id, externalUserPublicId: null },
      data: { externalUserPublicId: u.userPublicId },
    });
    campaignUsersUpdated += r.count;
  }

  // fullSync => deactivate users not in payload
  let deactivated = 0;
  if (fullSync) {
    const keep = Array.from(seenEmails.values());
    const r = await prisma.user.updateMany({
      where: {
        tenantId,
        email: { notIn: keep },
        isActive: true,
      },
      data: { isActive: false },
    });
    deactivated = r.count;
  }

  res.json({
    ok: true,
    tenantId,
    fullSync,
    received: items.length,
    valid: normalized.length,
    upserted,
    deactivated,
    campaignUsersUpdated,
  });
});

export default router;