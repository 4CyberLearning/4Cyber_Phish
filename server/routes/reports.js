import express from "express";
import prisma from "../db/prisma.js";

const router = express.Router();

function parseRange(req) {
  const now = new Date();
  const range = String(req.query.range || "90d").trim();

  // explicit from/to mají prioritu (volitelné)
  if (req.query.from && req.query.to) {
    const from = new Date(String(req.query.from));
    const to = new Date(String(req.query.to));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) return { from, to, range: "custom" };
  }

  const m = /^(\d+)\s*d$/.exec(range);
  const days = m ? Math.min(3650, Math.max(1, Number(m[1]))) : 90;
  const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
  return { from, to: now, range: `${days}d` };
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function rate(n, d) {
  if (!d || d <= 0) return 0;
  return n / d;
}

// risk: jednoduchá robustní metrika (0–100)
function riskScore(clickRate, submitRate, reportRate) {
  const r = (0.55 * submitRate) + (0.45 * clickRate) - (0.25 * reportRate);
  return Math.max(0, Math.min(100, Math.round(r * 100)));
}

// GET /api/reports/summary
router.get("/summary", async (req, res) => {
  const tenantId = req.integration.tenantId;
  const { from, to, range } = parseRange(req);

  const baseWhere = {
    campaign: { tenantId },
    sentAt: { gte: from, lt: to },
  };

  const sent = await prisma.campaignUser.count({ where: baseWhere });

  const delivered = await prisma.campaignUser.count({
    where: { ...baseWhere, delivered: true },
  });

  const opened = await prisma.campaignUser.count({ where: { ...baseWhere, openedAt: { not: null } } });
  const clicked = await prisma.campaignUser.count({ where: { ...baseWhere, clickedAt: { not: null } } });
  const submitted = await prisma.campaignUser.count({ where: { ...baseWhere, submittedAt: { not: null } } });
  const reported = await prisma.campaignUser.count({ where: { ...baseWhere, reportedAt: { not: null } } });

  // bounced: pokud nemáš explicitně, nech 0 nebo odvoď (sent - delivered) jen pokud delivered opravdu značí SMTP success
  const bounced = Math.max(0, sent - delivered);

  const lastCampaign = await prisma.campaign.findFirst({
    where: { tenantId, scheduledAt: { lt: to } },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });

  const nextCampaign = await prisma.campaign.findFirst({
    where: { tenantId, scheduledAt: { gt: new Date() } },
    orderBy: { scheduledAt: "asc" },
    select: { scheduledAt: true },
  });

  const recentCampaigns = await prisma.campaign.findMany({
    where: { tenantId, scheduledAt: { gte: from, lt: to } },
    orderBy: { scheduledAt: "desc" },
    take: 10,
    select: { id: true, name: true, status: true, scheduledAt: true },
  });

  // per-campaign totals (jednoduché – N+1, pro start OK; později optimalizujeme)
  const recentWithTotals = [];
  for (const c of recentCampaigns) {
    const cw = { campaignId: c.id, sentAt: { not: null } };
    const csent = await prisma.campaignUser.count({ where: cw });
    const cdel = await prisma.campaignUser.count({ where: { ...cw, delivered: true } });
    const copen = await prisma.campaignUser.count({ where: { ...cw, openedAt: { not: null } } });
    const cclick = await prisma.campaignUser.count({ where: { ...cw, clickedAt: { not: null } } });
    const csub = await prisma.campaignUser.count({ where: { ...cw, submittedAt: { not: null } } });
    const crep = await prisma.campaignUser.count({ where: { ...cw, reportedAt: { not: null } } });

    recentWithTotals.push({
      id: c.id,
      name: c.name,
      status: c.status,
      scheduledAt: c.scheduledAt,
      totals: {
        sent: csent,
        delivered: cdel,
        opened: copen,
        clicked: cclick,
        submitted: csub,
        reported: crep,
        bounced: Math.max(0, csent - cdel),
      },
    });
  }

  res.json({
    schemaVersion: "1.0",
    period: { range, from: from.toISOString(), to: to.toISOString() },
    totals: { sent, delivered, opened, clicked, submitted, reported, bounced },
    rates: {
      openRate: rate(opened, delivered),
      clickRate: rate(clicked, delivered),
      submitRate: rate(submitted, delivered),
      reportRate: rate(reported, delivered),
    },
    campaigns: {
      lastRunAt: lastCampaign?.scheduledAt?.toISOString?.() || null,
      nextRunAt: nextCampaign?.scheduledAt?.toISOString?.() || null,
    },
    recentCampaigns: recentWithTotals,
  });
});

// GET /api/reports/users
router.get("/users", async (req, res) => {
  const tenantId = req.integration.tenantId;
  const { from, to, range } = parseRange(req);

  const page = clampInt(req.query.page, 1, 1, 100000);
  const pageSize = clampInt(req.query.pageSize, 50, 10, 200);
  const sort = String(req.query.sort || "riskScore_desc").trim();

  // Na začátek robustně: stáhneme agregaci per user v paměti pro dané období.
  // Pokud čekáš tisíce uživatelů * stovky kampaní, přepneme to na SQL agregaci.
  const rows = await prisma.campaignUser.findMany({
    where: {
      campaign: { tenantId },
      sentAt: { gte: from, lt: to },
      externalUserPublicId: { not: null },
    },
    select: {
      externalUserPublicId: true,
      delivered: true,
      openedAt: true,
      clickedAt: true,
      submittedAt: true,
      reportedAt: true,
      sentAt: true,
    },
  });

  const map = new Map();
  for (const r of rows) {
    const id = r.externalUserPublicId;
    const cur = map.get(id) || {
      userPublicId: id,
      totals: { delivered: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 },
      lastEventAt: null,
    };

    if (r.delivered) cur.totals.delivered += 1;
    if (r.openedAt) cur.totals.opened += 1;
    if (r.clickedAt) cur.totals.clicked += 1;
    if (r.submittedAt) cur.totals.submitted += 1;
    if (r.reportedAt) cur.totals.reported += 1;

    const last = r.reportedAt || r.submittedAt || r.clickedAt || r.openedAt || r.sentAt;
    if (last && (!cur.lastEventAt || new Date(last) > new Date(cur.lastEventAt))) cur.lastEventAt = last;

    map.set(id, cur);
  }

  const items = Array.from(map.values()).map((u) => {
    const delivered = u.totals.delivered;
    const clickRate = rate(u.totals.clicked, delivered);
    const submitRate = rate(u.totals.submitted, delivered);
    const reportRate = rate(u.totals.reported, delivered);
    return {
      userPublicId: u.userPublicId,
      totals: u.totals,
      rates: { clickRate, submitRate, reportRate, openRate: rate(u.totals.opened, delivered) },
      riskScore: riskScore(clickRate, submitRate, reportRate),
      lastEventAt: u.lastEventAt ? new Date(u.lastEventAt).toISOString() : null,
    };
  });

  // sort
  const cmp = (a, b) => {
    const dir = sort.endsWith("_asc") ? 1 : -1;
    const key = sort.replace(/_(asc|desc)$/, "");
    const va =
      key === "riskScore" ? a.riskScore :
      key === "clickRate" ? a.rates.clickRate :
      key === "submitRate" ? a.rates.submitRate :
      key === "reportRate" ? a.rates.reportRate :
      key === "lastEventAt" ? (a.lastEventAt || "") :
      a.riskScore;
    const vb =
      key === "riskScore" ? b.riskScore :
      key === "clickRate" ? b.rates.clickRate :
      key === "submitRate" ? b.rates.submitRate :
      key === "reportRate" ? b.rates.reportRate :
      key === "lastEventAt" ? (b.lastEventAt || "") :
      b.riskScore;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  };
  items.sort(cmp);

  const totalUsers = items.length;
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  res.json({
    schemaVersion: "1.0",
    period: { range, from: from.toISOString(), to: to.toISOString() },
    page,
    pageSize,
    totalUsers,
    items: paged,
  });
});

// GET /api/reports/users/:userPublicId
router.get("/users/:userPublicId", async (req, res) => {
  const tenantId = req.integration.tenantId;
  const { from, to, range } = parseRange(req);
  const userPublicId = String(req.params.userPublicId || "").trim();

  const rows = await prisma.campaignUser.findMany({
    where: {
      campaign: { tenantId },
      sentAt: { gte: from, lt: to },
      externalUserPublicId: userPublicId,
    },
    orderBy: { sentAt: "desc" },
    take: 200,
    select: {
      campaignId: true,
      sentAt: true,
      delivered: true,
      openedAt: true,
      clickedAt: true,
      submittedAt: true,
      reportedAt: true,
    },
  });

  res.json({
    schemaVersion: "1.0",
    userPublicId,
    period: { range, from: from.toISOString(), to: to.toISOString() },
    events: rows.map((r) => ({
      campaignId: r.campaignId,
      sentAt: r.sentAt?.toISOString?.() || null,
      delivered: !!r.delivered,
      openedAt: r.openedAt?.toISOString?.() || null,
      clickedAt: r.clickedAt?.toISOString?.() || null,
      submittedAt: r.submittedAt?.toISOString?.() || null,
      reportedAt: r.reportedAt?.toISOString?.() || null,
    })),
  });
});

export default router;