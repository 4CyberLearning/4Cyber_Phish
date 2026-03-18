import express from "express";
import prisma from "../db/prisma.js";

const router = express.Router();

function parseRange(req) {
  const now = new Date();
  const range = String(req.query.range || "90d").trim();

  if (req.query.from && req.query.to) {
    const from = new Date(String(req.query.from));
    const to = new Date(String(req.query.to));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
      return { from, to, range: "custom" };
    }
  }

  const m = /^(\d+)\s*d$/.exec(range);
  const days = m ? Math.min(3650, Math.max(1, Number(m[1]))) : 90;
  const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
  return { from, to: now, range: `${days}d` };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
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

function riskScore(clickRate, submitRate, reportRate) {
  const r = (0.55 * submitRate) + (0.45 * clickRate) - (0.25 * reportRate);
  return Math.max(0, Math.min(100, Math.round(r * 100)));
}

function riskBucketFromScore(score) {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function riskLabelFromBucket(bucket) {
  if (bucket === "high") return "Vysoké riziko";
  if (bucket === "medium") return "Střední riziko";
  return "Nízké riziko";
}

function isoOrNull(value) {
  return value?.toISOString?.() || null;
}

function getLastEventAt(row) {
  return row.reportedAt || row.submittedAt || row.clickedAt || row.openedAt || row.sentAt || null;
}

function getEventKey(row) {
  if (row.submittedAt) return "submitted";
  if (row.clickedAt) return "clicked";
  if (row.reportedAt) return "reported";
  return "delivered";
}

function getEventLabel(eventKey) {
  if (eventKey === "submitted") return "Vyplněno";
  if (eventKey === "clicked") return "Kliknuto";
  if (eventKey === "reported") return "Nahlášeno";
  return "Doručeno";
}

function formatAvgReportTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const hours = Math.max(1, Math.round(ms / 3600000));
  if (hours < 24) return `${hours} h`;
  const days = Math.max(1, Math.round(hours / 24));
  return `${days} d`;
}

function buildPreviewCampaign(item) {
  const senderDomain = item?.campaign?.senderIdentity?.senderDomain?.domain || "";
  const localPart = item?.campaign?.senderIdentity?.localPart || "";
  const senderEmail = localPart && senderDomain ? `${localPart}@${senderDomain}` : "";
  const hasLandingPage = Boolean(item?.campaign?.landingPageId);
  const eventKey = getEventKey(item);

  return {
    id: `${item.campaignId}-${item.externalUserPublicId || item.user?.externalUserPublicId || "user"}`,
    campaignId: item.campaignId,
    campaignName: item?.campaign?.name || `Campaign ${item.campaignId}`,
    name: item?.campaign?.name || `Campaign ${item.campaignId}`,
    audience: item?.campaign?.targetGroup?.name || item?.user?.department || "—",
    status: item?.campaign?.status || null,
    scheduledAt: isoOrNull(item?.campaign?.scheduledAt),
    sentAt: isoOrNull(item?.sentAt),
    delivered: item?.delivered ? 1 : 0,
    clickRate: item?.clickedAt || item?.submittedAt ? 1 : 0,
    submitRate: hasLandingPage ? (item?.submittedAt ? 1 : 0) : 0,
    reportRate: item?.reportedAt ? 1 : 0,
    hasLandingPage,
    event: eventKey,
    eventLabel: getEventLabel(eventKey),
    senderIdentity: {
      displayName: item?.campaign?.senderIdentity?.fromName || item?.campaign?.senderIdentity?.name || "Security Notification",
      email: senderEmail || "—",
      replyTo: item?.campaign?.senderIdentity?.replyTo || senderEmail || "—",
      domain: senderDomain || "—",
    },
    emailTemplate: {
      subject: item?.campaign?.emailTemplate?.subject || item?.campaign?.emailTemplate?.name || item?.campaign?.name || "—",
      preheader: item?.campaign?.package?.previewText || "",
      heading: item?.campaign?.package?.name || item?.campaign?.name || "Kampaň",
      intro: item?.campaign?.description || item?.campaign?.package?.description || "Phishingová kampaň.",
      cta: "Pokračovat",
      footer: "",
    },
    landingPage: hasLandingPage
      ? {
          title: item?.campaign?.landingPage?.name || "Landing page",
          subtitle: item?.campaign?.package?.previewText || item?.campaign?.package?.description || "",
          fields: ["Firemní e-mail", "Heslo"],
          cta: "Pokračovat",
        }
      : null,
  };
}

function buildTimeline(campaigns = []) {
  return campaigns
    .flatMap((item) => {
      const events = [];
      if (item?.sentAt) {
        events.push({
          id: `${item.id}-timeline-delivered`,
          at: item.sentAt,
          label: "Doručeno",
          campaignName: item.campaignName,
        });
      }

      if (item?.event === "clicked" || item?.event === "submitted") {
        events.push({
          id: `${item.id}-timeline-clicked`,
          at: item.sentAt,
          label: "Kliknuto",
          campaignName: item.campaignName,
        });
      }

      if (item?.event === "submitted") {
        events.push({
          id: `${item.id}-timeline-submitted`,
          at: item.sentAt,
          label: "Vyplněno",
          campaignName: item.campaignName,
        });
      }

      if (item?.event === "reported") {
        events.push({
          id: `${item.id}-timeline-reported`,
          at: item.sentAt,
          label: "Nahlášeno",
          campaignName: item.campaignName,
        });
      }

      return events;
    })
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
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
  const delivered = await prisma.campaignUser.count({ where: { ...baseWhere, delivered: true } });
  const opened = await prisma.campaignUser.count({ where: { ...baseWhere, openedAt: { not: null } } });
  const clicked = await prisma.campaignUser.count({ where: { ...baseWhere, clickedAt: { not: null } } });
  const submitted = await prisma.campaignUser.count({ where: { ...baseWhere, submittedAt: { not: null } } });
  const reported = await prisma.campaignUser.count({ where: { ...baseWhere, reportedAt: { not: null } } });
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
    schemaVersion: "1.1",
    period: { range, from: from.toISOString(), to: to.toISOString() },
    totals: { sent, delivered, opened, clicked, submitted, reported, bounced },
    rates: {
      openRate: rate(opened, delivered),
      clickRate: rate(clicked, delivered),
      submitRate: rate(submitted, delivered),
      reportRate: rate(reported, delivered),
    },
    campaigns: {
      lastRunAt: isoOrNull(lastCampaign?.scheduledAt),
      nextRunAt: isoOrNull(nextCampaign?.scheduledAt),
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

  const rows = await prisma.campaignUser.findMany({
    where: {
      campaign: { tenantId },
      sentAt: { gte: from, lt: to },
    },
    select: {
      externalUserPublicId: true,
      delivered: true,
      openedAt: true,
      clickedAt: true,
      submittedAt: true,
      reportedAt: true,
      sentAt: true,
      user: {
        select: {
          externalUserPublicId: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  const map = new Map();
  for (const r of rows) {
    const canonicalId = isUuid(r?.user?.externalUserPublicId)
      ? r.user.externalUserPublicId
      : isUuid(r?.externalUserPublicId)
      ? r.externalUserPublicId
      : null;

    if (!canonicalId) continue;

    const cur = map.get(canonicalId) || {
      userPublicId: canonicalId,
      totals: {
        delivered: 0,
        opened: 0,
        clicked: 0,
        submitted: 0,
        reported: 0,
        submitEligible: 0,
      },
      profile: r.user
        ? {
            name:
              r.user.fullName ||
              [r.user.firstName, r.user.lastName].filter(Boolean).join(" ").trim() ||
              null,
            email: r.user.email || null,
            isActive: !!r.user.isActive,
          }
        : null,
      lastEventAt: null,
    };

    if (r.campaign?.landingPageId) cur.totals.submitEligible += 1;
    if (r.delivered) {
      cur.totals.delivered += 1;
      cur.totals.submitEligible += 1;
    }
    if (r.openedAt) cur.totals.opened += 1;
    if (r.clickedAt) cur.totals.clicked += 1;
    if (r.submittedAt) cur.totals.submitted += 1;
    if (r.reportedAt) cur.totals.reported += 1;

    const last = getLastEventAt(r);
    if (last && (!cur.lastEventAt || new Date(last) > new Date(cur.lastEventAt))) cur.lastEventAt = last;

    map.set(canonicalId, cur);
  }

  const items = Array.from(map.values()).map((u) => {
    const deliveredCount = u.totals.delivered;
    const submitEligible = u.totals.submitEligible;
    const clickRate = rate(u.totals.clicked, deliveredCount);
    const submitRate = rate(u.totals.submitted, submitEligible);
    const reportRate = rate(u.totals.reported, deliveredCount);
    const score = riskScore(clickRate, submitRate, reportRate);
    const bucket = riskBucketFromScore(score);

    return {
      userPublicId: u.userPublicId,
      totals: u.totals,
      rates: {
        clickRate,
        submitRate,
        reportRate,
        openRate: rate(u.totals.opened, deliveredCount),
      },
      riskScore: score,
      riskBucket: bucket,
      riskLabel: riskLabelFromBucket(bucket),
      lastEventAt: isoOrNull(u.lastEventAt),
    };
  });

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
    schemaVersion: "1.1",
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

  const [userRecord, rows] = await Promise.all([
    prisma.user.findFirst({
      where: { tenantId, externalUserPublicId: userPublicId },
      select: {
        externalUserPublicId: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        department: true,
        role: true,
        isActive: true,
      },
    }),
    prisma.campaignUser.findMany({
      where: {
        campaign: { tenantId },
        sentAt: { gte: from, lt: to },
        externalUserPublicId: userPublicId,
      },
      orderBy: { sentAt: "desc" },
      take: 200,
      select: {
        campaignId: true,
        externalUserPublicId: true,
        sentAt: true,
        delivered: true,
        openedAt: true,
        clickedAt: true,
        submittedAt: true,
        reportedAt: true,
        user: {
          select: {
            externalUserPublicId: true,
            email: true,
            department: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            scheduledAt: true,
            landingPageId: true,
            targetGroup: { select: { name: true } },
            package: {
              select: {
                id: true,
                name: true,
                description: true,
                previewText: true,
              },
            },
            emailTemplate: {
              select: {
                id: true,
                name: true,
                subject: true,
              },
            },
            landingPage: {
              select: {
                id: true,
                name: true,
                urlSlug: true,
              },
            },
            senderIdentity: {
              select: {
                id: true,
                name: true,
                fromName: true,
                localPart: true,
                replyTo: true,
                senderDomain: {
                  select: {
                    domain: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const totals = { delivered: 0, opened: 0, clicked: 0, submitted: 0, reported: 0, submitEligible: 0 };
  let lastEventAt = null;
  const reportDurations = [];

  for (const row of rows) {
    if (row.campaign?.landingPageId) totals.submitEligible += 1;
    if (row.delivered) totals.delivered += 1;
    if (row.openedAt) totals.opened += 1;
    if (row.clickedAt) totals.clicked += 1;
    if (row.submittedAt) totals.submitted += 1;
    if (row.reportedAt) totals.reported += 1;

    const last = getLastEventAt(row);
    if (last && (!lastEventAt || new Date(last) > new Date(lastEventAt))) lastEventAt = last;

    if (row.sentAt && row.reportedAt) {
      reportDurations.push(new Date(row.reportedAt).getTime() - new Date(row.sentAt).getTime());
    }
  }

  const clickRate = rate(totals.clicked, totals.delivered);
  const submitRate = rate(totals.submitted, totals.submitEligible);
  const reportRate = rate(totals.reported, totals.delivered);
  const score = riskScore(clickRate, submitRate, reportRate);
  const bucket = riskBucketFromScore(score);
  const campaigns = rows.map((row) => buildPreviewCampaign(row));
  const avgReportTimeMs = reportDurations.length
    ? reportDurations.reduce((acc, value) => acc + value, 0) / reportDurations.length
    : NaN;

  const externalUser = userRecord
    ? {
        userPublicId: userRecord.externalUserPublicId,
        name: userRecord.firstName || userRecord.fullName || "",
        surname: userRecord.lastName || "",
        email: userRecord.email || null,
        department: userRecord.department || null,
        role: userRecord.role || null,
        isActive: userRecord.isActive,
      }
    : null;

  const primaryRiskDriver =
    submitRate > 0 && submitRate >= clickRate
      ? "Vyplnění formuláře"
      : clickRate > 0
        ? "Kliknutí"
        : reportRate > 0
          ? "Nahlášení"
          : "—";

  res.json({
    schemaVersion: "1.1",
    userPublicId,
    user: externalUser,
    period: { range, from: from.toISOString(), to: to.toISOString() },
    totals,
    rates: {
      clickRate,
      submitRate,
      reportRate,
      openRate: rate(totals.opened, totals.delivered),
    },
    riskScore: score,
    riskBucket: bucket,
    riskLabel: riskLabelFromBucket(bucket),
    lastEventAt: isoOrNull(lastEventAt),
    profile: {
      campaignsTargeted: rows.length,
      primaryRiskDriver,
      avgReportTime: formatAvgReportTime(avgReportTimeMs),
    },
    campaigns,
    history: campaigns,
    timeline: buildTimeline(campaigns),
    events: rows.map((r) => ({
      campaignId: r.campaignId,
      sentAt: isoOrNull(r.sentAt),
      delivered: !!r.delivered,
      openedAt: isoOrNull(r.openedAt),
      clickedAt: isoOrNull(r.clickedAt),
      submittedAt: isoOrNull(r.submittedAt),
      reportedAt: isoOrNull(r.reportedAt),
    })),
  });
});

export default router;
