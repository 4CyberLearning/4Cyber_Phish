import express from "express";
import { CampaignStatus } from "@prisma/client";
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

  const m = /^(\d+)\s*d$/i.exec(range);
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

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n : Math.round(n * 10000) / 100;
}

function toIso(value) {
  return value?.toISOString?.() || value || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

function getCanonicalUserPublicId(row) {
  const viaUser = String(row?.user?.externalUserPublicId || "").trim();
  if (isUuid(viaUser)) return viaUser;

  const viaCampaignUser = String(row?.externalUserPublicId || "").trim();
  if (isUuid(viaCampaignUser)) return viaCampaignUser;

  return null;
}

function buildUserShape(user) {
  if (!user) return null;
  const fullName = String(user?.fullName || "").trim();
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();

  let name = firstName;
  let surname = lastName;

  if (!name && !surname && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    name = parts.shift() || "";
    surname = parts.join(" ");
  }

  return {
    name: name || "",
    surname: surname || "",
    email: user?.email || "",
    department: user?.department || "",
    isActive: user?.isActive !== false,
  };
}

function riskScore(clickRate, submitRate, reportRate) {
  const r = (0.55 * submitRate) + (0.45 * clickRate) - (0.25 * reportRate);
  return Math.max(0, Math.min(100, Math.round(r * 100)));
}

function riskBucket(score) {
  if (score > 20) return "high";
  if (score >= 10) return "medium";
  return "low";
}

function riskLabel(bucket) {
  if (bucket === "high") return "Vysoké riziko";
  if (bucket === "medium") return "Střední riziko";
  return "Nízké riziko";
}

function bucketThreshold(bucket) {
  if (bucket === "high") return "nad 20 %";
  if (bucket === "medium") return "10–20 %";
  return "pod 10 %";
}

function bucketHelper(bucket) {
  if (bucket === "high") return "úspěšnost nad 20 %";
  if (bucket === "medium") return "úspěšnost 10–20 %";
  return "úspěšnost pod 10 %";
}

function eventLabel(type) {
  if (type === "reported") return "Nahlášeno";
  if (type === "submitted") return "Vyplněno";
  if (type === "clicked") return "Kliknuto";
  if (type === "opened") return "Otevřeno";
  if (type === "sent") return "Doručeno";
  return "Událost";
}

function avgReportTimeLabel(samples = []) {
  if (!samples.length) return "—";
  const avgMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const totalMinutes = Math.round(avgMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

async function loadRowsForTenant(tenantId, from, to) {
  return prisma.campaignUser.findMany({
    where: {
      campaign: { tenantId },
      sentAt: { gte: from, lt: to },
    },
    select: {
      campaignId: true,
      externalUserPublicId: true,
      delivered: true,
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      submittedAt: true,
      reportedAt: true,
      user: {
        select: {
          externalUserPublicId: true,
          firstName: true,
          lastName: true,
          fullName: true,
          email: true,
          department: true,
          isActive: true,
        },
      },
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          description: true,
          scheduledAt: true,
          cutoffAt: true,
          startedAt: true,
          finishedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          landingPageId: true,
          recipientCountSnapshot: true,
          targetGroup: { select: { name: true } },
          senderIdentity: {
            select: {
              fromName: true,
              localPart: true,
              replyTo: true,
              senderDomain: { select: { domain: true } },
            },
          },
          emailTemplate: {
            select: {
              subject: true,
              name: true,
              bodyHtml: true,
            },
          },
          landingPage: {
            select: {
              name: true,
              urlSlug: true,
              html: true,
            },
          },
        },
      },
    },
    orderBy: [{ campaignId: "desc" }, { sentAt: "desc" }],
  });
}

function buildCampaignAnchorDate(campaign) {
  return (
    campaign?.startedAt ||
    campaign?.scheduledAt ||
    campaign?.finishedAt ||
    campaign?.cancelledAt ||
    campaign?.createdAt ||
    null
  );
}

function buildCampaignSenderIdentity(senderIdentity) {
  if (!senderIdentity) return null;
  const email =
    senderIdentity.localPart && senderIdentity.senderDomain?.domain
      ? `${senderIdentity.localPart}@${senderIdentity.senderDomain.domain}`
      : "";

  return {
    displayName: senderIdentity.fromName || "Security Notification",
    email,
    replyTo: senderIdentity.replyTo || email,
    domain: senderIdentity.senderDomain?.domain || "",
  };
}

function aggregateRows(rows = []) {
  const userMap = new Map();

  const totals = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    submitEligible: 0,
    submitted: 0,
    reported: 0,
    bounced: 0,
  };

  for (const row of rows) {
    totals.sent += 1;
    if (row.delivered) {
      totals.delivered += 1;
      totals.submitEligible += 1;
    } else {
      totals.bounced += 1;
    }
    if (row.openedAt) totals.opened += 1;
    if (row.clickedAt) totals.clicked += 1;
    if (row.submittedAt) totals.submitted += 1;
    if (row.reportedAt) totals.reported += 1;

    const canonicalId = getCanonicalUserPublicId(row);
    if (!canonicalId) continue;

    const userCur = userMap.get(canonicalId) || {
      userPublicId: canonicalId,
      user: buildUserShape(row.user),
      totals: {
        delivered: 0,
        opened: 0,
        clicked: 0,
        submitEligible: 0,
        submitted: 0,
        reported: 0,
      },
      lastEventAt: null,
      profile: {
        campaignsTargeted: 0,
      },
      reportSamples: [],
    };

    userCur.profile.campaignsTargeted += 1;
    if (row.delivered) {
      userCur.totals.delivered += 1;
      userCur.totals.submitEligible += 1;
    }
    if (row.openedAt) userCur.totals.opened += 1;
    if (row.clickedAt) userCur.totals.clicked += 1;
    if (row.submittedAt) userCur.totals.submitted += 1;
    if (row.reportedAt) userCur.totals.reported += 1;

    if (row.sentAt && row.reportedAt) {
      const sentMs = new Date(row.sentAt).getTime();
      const reportedMs = new Date(row.reportedAt).getTime();
      if (Number.isFinite(sentMs) && Number.isFinite(reportedMs) && reportedMs >= sentMs) {
        userCur.reportSamples.push(reportedMs - sentMs);
      }
    }

    const last = row.reportedAt || row.submittedAt || row.clickedAt || row.openedAt || row.sentAt;
    if (last && (!userCur.lastEventAt || new Date(last) > new Date(userCur.lastEventAt))) {
      userCur.lastEventAt = last;
    }

    userMap.set(canonicalId, userCur);
  }

  const users = Array.from(userMap.values()).map((item) => {
    const delivered = item.totals.delivered;
    const openRate = rate(item.totals.opened, delivered);
    const clickRate = rate(item.totals.clicked, delivered);
    const submitRate = rate(item.totals.submitted, item.totals.submitEligible);
    const reportRate = rate(item.totals.reported, delivered);
    const score = riskScore(clickRate, submitRate, reportRate);
    const bucket = riskBucket(score);

    return {
      userPublicId: item.userPublicId,
      user: item.user || null,
      totals: item.totals,
      rates: { openRate, clickRate, submitRate, reportRate },
      riskScore: score,
      riskBucket: bucket,
      riskLabel: riskLabel(bucket),
      lastEventAt: item.lastEventAt ? new Date(item.lastEventAt).toISOString() : null,
      profile: {
        campaignsTargeted: item.profile.campaignsTargeted,
        avgReportTime: avgReportTimeLabel(item.reportSamples),
      },
    };
  });

  return { totals, users };
}

async function loadCampaignsForSummary(tenantId, from, to) {
  return prisma.campaign.findMany({
    where: {
      tenantId,
      OR: [
        { createdAt: { gte: from, lt: to } },
        { scheduledAt: { gte: from, lt: to } },
        { startedAt: { gte: from, lt: to } },
        { finishedAt: { gte: from, lt: to } },
        { cancelledAt: { gte: from, lt: to } },
        {
          AND: [
            { status: CampaignStatus.RUNNING },
            { startedAt: { lt: to } },
            {
              OR: [
                { cutoffAt: null },
                { cutoffAt: { gte: from } },
              ],
            },
          ],
        },
        {
          AND: [
            { status: CampaignStatus.SCHEDULED },
            { scheduledAt: { lt: to } },
            {
              OR: [
                { cutoffAt: null },
                { cutoffAt: { gte: from } },
              ],
            },
          ],
        },
      ],
    },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          category: true,
          difficulty: true,
        },
      },
      targetGroup: { select: { name: true } },
      senderIdentity: {
        select: {
          fromName: true,
          localPart: true,
          replyTo: true,
          senderDomain: { select: { domain: true } },
        },
      },
      emailTemplate: {
        select: {
          subject: true,
          name: true,
          bodyHtml: true,
        },
      },
      landingPage: {
        select: {
          name: true,
          urlSlug: true,
          html: true,
        },
      },
      targetUsers: {
        select: {
          delivered: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          submittedAt: true,
          reportedAt: true,
        },
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

function buildRecentCampaignShape(row) {
  const recipients = Array.isArray(row?.targetUsers) ? row.targetUsers : [];
  const delivered = recipients.filter((item) => item?.delivered).length;
  const opened = recipients.filter((item) => item?.openedAt).length;
  const clicked = recipients.filter((item) => item?.clickedAt).length;
  const submitted = recipients.filter((item) => item?.submittedAt).length;
  const reported = recipients.filter((item) => item?.reportedAt).length;
  const sent = recipients.filter((item) => item?.sentAt).length;
  const bounced = Math.max(0, sent - delivered);
  const recipientCountSnapshot = Number(row?.recipientCountSnapshot || recipients.length || 0);
  const submitEligible = delivered;
  const clickRate = rate(clicked, delivered);
  const submitRate = rate(submitted, submitEligible);
  const reportRate = rate(reported, delivered);

  return {
    id: row.id,
    name: row.name || "Bez názvu",
    description: row.description || "",
    status: row.status || CampaignStatus.SCHEDULED,
    audience: row?.targetGroup?.name || "Vybraná skupina",
    scheduledAt: toIso(row.scheduledAt),
    cutoffAt: toIso(row.cutoffAt),
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
    cancelledAt: toIso(row.cancelledAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    hasLandingPage: !!row.landingPageId,
    recipientCountSnapshot,
    statusReason: row.statusReason || null,
    finishReason: row.finishReason || null,
    senderIdentity: buildCampaignSenderIdentity(row.senderIdentity),
    emailTemplate: row.emailTemplate
      ? {
          subject: row.emailTemplate.subject || row.emailTemplate.name || row.name || "—",
          bodyHtml: row.emailTemplate.bodyHtml || "",
        }
      : null,
    landingPage: row.landingPage
      ? {
          title: row.landingPage.name || "Landing page",
          slug: row.landingPage.urlSlug || "",
          html: row.landingPage.html || "",
        }
      : null,
    package: row.package
      ? {
          id: row.package.id,
          name: row.package.name,
          category: row.package.category || "",
          difficulty: row.package.difficulty ?? 1,
        }
      : null,
    totals: {
      sent,
      delivered,
      opened,
      clicked,
      submitEligible,
      submitted,
      reported,
      bounced,
    },
    clickRate,
    submitRate,
    reportRate,
    lifecycleAnchorAt: toIso(buildCampaignAnchorDate(row)),
  };
}

function buildTrendPoints(campaigns = [], from) {
  if (!campaigns.length) {
    return [
      {
        key: `${from.toISOString()}-0`,
        label: from.toLocaleDateString("cs-CZ"),
        date: from.toISOString(),
        clickRate: 0,
        submitRate: 0,
        reportRate: 0,
        clickedCount: 0,
        deliveredCount: 0,
        submitCount: 0,
        submitEligibleCount: 0,
        reportCount: 0,
        campaigns: [],
      },
    ];
  }

  return [...campaigns]
    .slice(0, 12)
    .sort((a, b) => new Date(a.lifecycleAnchorAt || 0) - new Date(b.lifecycleAnchorAt || 0))
    .map((campaign) => ({
      key: `campaign-${campaign.id}`,
      label: new Date(campaign.lifecycleAnchorAt || 0).toLocaleDateString("cs-CZ"),
      date: campaign.lifecycleAnchorAt || null,
      clickRate: pct(campaign.clickRate),
      submitRate: campaign.hasLandingPage ? pct(campaign.submitRate) : 0,
      reportRate: pct(campaign.reportRate),
      clickedCount: Number(campaign?.totals?.clicked || 0),
      deliveredCount: Number(campaign?.totals?.delivered || 0),
      submitCount: Number(campaign?.totals?.submitted || 0),
      submitEligibleCount: Number(campaign?.totals?.submitEligible || 0),
      reportCount: Number(campaign?.totals?.reported || 0),
      campaigns: [
        {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
        },
      ],
    }));
}

function buildRiskBuckets(users = []) {
  const keys = ["high", "medium", "low"];
  return keys.map((key) => {
    const bucketUsers = users
      .filter((item) => item.riskBucket === key)
      .sort((a, b) => b.riskScore - a.riskScore);

    return {
      key,
      label: riskLabel(key),
      threshold: bucketThreshold(key),
      helper: bucketHelper(key),
      count: bucketUsers.length,
      users: bucketUsers,
    };
  });
}

function sortUsers(items = [], sort = "riskScore_desc") {
  const dir = sort.endsWith("_asc") ? 1 : -1;
  const key = sort.replace(/_(asc|desc)$/, "");

  return [...items].sort((a, b) => {
    const va =
      key === "riskScore" ? a.riskScore :
      key === "clickRate" ? a.rates.clickRate :
      key === "submitRate" ? a.rates.submitRate :
      key === "reportRate" ? a.rates.reportRate :
      key === "lastEventAt" ? new Date(a.lastEventAt || 0).getTime() :
      a.riskScore;

    const vb =
      key === "riskScore" ? b.riskScore :
      key === "clickRate" ? b.rates.clickRate :
      key === "submitRate" ? b.rates.submitRate :
      key === "reportRate" ? b.rates.reportRate :
      key === "lastEventAt" ? new Date(b.lastEventAt || 0).getTime() :
      b.riskScore;

    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

router.get("/summary", async (req, res) => {
  try {
    const tenantId = req.integration.tenantId;
    const { from, to, range } = parseRange(req);

    const [rows, campaignRows, nextScheduled] = await Promise.all([
      loadRowsForTenant(tenantId, from, to),
      loadCampaignsForSummary(tenantId, from, to),
      prisma.campaign.findFirst({
        where: {
          tenantId,
          scheduledAt: { gt: new Date() },
          status: CampaignStatus.SCHEDULED,
        },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      }),
    ]);

    const { totals, users } = aggregateRows(rows);
    const delivered = totals.delivered;
    const recentCampaigns = campaignRows.map(buildRecentCampaignShape).slice(0, 10);

    res.json({
      schemaVersion: "1.3",
      source: "live",
      period: { range, from: from.toISOString(), to: to.toISOString() },
      totals,
      rates: {
        openRate: rate(totals.opened, delivered),
        clickRate: rate(totals.clicked, delivered),
        submitRate: rate(totals.submitted, totals.submitEligible),
        reportRate: rate(totals.reported, delivered),
      },
      meta: {
        totalCampaigns: campaignRows.length,
        statusCounts: {
          draft: campaignRows.filter((item) => item.status === CampaignStatus.DRAFT).length,
          scheduled: campaignRows.filter((item) => item.status === CampaignStatus.SCHEDULED).length,
          running: campaignRows.filter((item) => item.status === CampaignStatus.RUNNING).length,
          finished: campaignRows.filter((item) => item.status === CampaignStatus.FINISHED).length,
          cancelled: campaignRows.filter((item) => item.status === CampaignStatus.CANCELLED).length,
        },
      },
      campaigns: {
        lastRunAt:
          recentCampaigns[0]?.startedAt ||
          recentCampaigns[0]?.finishedAt ||
          recentCampaigns[0]?.cancelledAt ||
          recentCampaigns[0]?.scheduledAt ||
          recentCampaigns[0]?.createdAt ||
          null,
        nextRunAt: nextScheduled?.scheduledAt?.toISOString?.() || null,
      },
      trends: buildTrendPoints(recentCampaigns, from),
      recentCampaigns,
      riskBuckets: buildRiskBuckets(users),
    });
  } catch (error) {
    console.error("GET /api/reports/summary error", error);
    res.status(500).json({ error: error?.message || "Failed to load summary" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const tenantId = req.integration.tenantId;
    const { from, to, range } = parseRange(req);

    const page = clampInt(req.query.page, 1, 1, 100000);
    const pageSize = clampInt(req.query.pageSize, 50, 10, 200);
    const sort = String(req.query.sort || "riskScore_desc").trim();

    const rows = await loadRowsForTenant(tenantId, from, to);
    const { users } = aggregateRows(rows);

    const sorted = sortUsers(users, sort);
    const totalUsers = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    res.json({
      schemaVersion: "1.1",
      period: { range, from: from.toISOString(), to: to.toISOString() },
      page,
      pageSize,
      totalUsers,
      items,
    });
  } catch (error) {
    console.error("GET /api/reports/users error", error);
    res.status(500).json({ error: error?.message || "Failed to load users" });
  }
});

router.get("/users/:userPublicId", async (req, res) => {
  try {
    const tenantId = req.integration.tenantId;
    const { from, to, range } = parseRange(req);
    const userPublicId = String(req.params.userPublicId || "").trim();

    const rows = await prisma.campaignUser.findMany({
      where: {
        campaign: { tenantId },
        sentAt: { gte: from, lt: to },
        OR: [
          { externalUserPublicId: userPublicId },
          { user: { externalUserPublicId: userPublicId } },
        ],
      },
      orderBy: [{ sentAt: "desc" }, { campaignId: "desc" }],
      select: {
        campaignId: true,
        externalUserPublicId: true,
        delivered: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        submittedAt: true,
        reportedAt: true,
        user: {
          select: {
            externalUserPublicId: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
            department: true,
            isActive: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            cutoffAt: true,
            startedAt: true,
            finishedAt: true,
            cancelledAt: true,
            landingPageId: true,
            targetGroup: { select: { name: true } },
          },
        },
      },
    });

    const canonicalRows = rows.filter((row) => getCanonicalUserPublicId(row) === userPublicId);

    const totals = {
      delivered: 0,
      opened: 0,
      clicked: 0,
      submitEligible: 0,
      submitted: 0,
      reported: 0,
    };

    const reportSamples = [];
    let lastEventAt = null;
    const timeline = [];
    const campaignHistory = [];

    const userShape = canonicalRows[0]?.user ? buildUserShape(canonicalRows[0].user) : null;

    for (const row of canonicalRows) {
      if (row.delivered) {
        totals.delivered += 1;
        totals.submitEligible += 1;
      }
      if (row.openedAt) totals.opened += 1;
      if (row.clickedAt) totals.clicked += 1;
      if (row.submittedAt) totals.submitted += 1;
      if (row.reportedAt) totals.reported += 1;

      if (row.sentAt && row.reportedAt) {
        const sentMs = new Date(row.sentAt).getTime();
        const reportedMs = new Date(row.reportedAt).getTime();
        if (Number.isFinite(sentMs) && Number.isFinite(reportedMs) && reportedMs >= sentMs) {
          reportSamples.push(reportedMs - sentMs);
        }
      }

      const last = row.reportedAt || row.submittedAt || row.clickedAt || row.openedAt || row.sentAt;
      if (last && (!lastEventAt || new Date(last) > new Date(lastEventAt))) {
        lastEventAt = last;
      }

      const eventType = row.reportedAt
        ? "reported"
        : row.submittedAt
          ? "submitted"
          : row.clickedAt
            ? "clicked"
            : row.openedAt
              ? "opened"
              : "sent";

      const entry = {
        id: `campaign-${row.campaignId}`,
        campaignId: row.campaignId,
        campaignName: row.campaign?.name || "Bez názvu",
        name: row.campaign?.name || "Bez názvu",
        audience: row.campaign?.targetGroup?.name || "Vybraná skupina",
        status: row.campaign?.status || CampaignStatus.SCHEDULED,
        scheduledAt: toIso(row.campaign?.scheduledAt),
        cutoffAt: toIso(row.campaign?.cutoffAt),
        startedAt: toIso(row.campaign?.startedAt),
        finishedAt: toIso(row.campaign?.finishedAt),
        cancelledAt: toIso(row.campaign?.cancelledAt),
        sentAt: toIso(row.sentAt),
        hasLandingPage: !!row.campaign?.landingPageId,
        delivered: row.delivered ? 1 : 0,
        clickRate: row.clickedAt ? 1 : 0,
        submitRate: row.submittedAt ? 1 : 0,
        reportRate: row.reportedAt ? 1 : 0,
        event: eventType,
        eventLabel: eventLabel(eventType),
      };

      campaignHistory.push(entry);

      const timelineEvents = [
        { type: "sent", at: row.sentAt },
        { type: "opened", at: row.openedAt },
        { type: "clicked", at: row.clickedAt },
        { type: "submitted", at: row.submittedAt },
        { type: "reported", at: row.reportedAt },
      ]
        .filter((item) => item.at)
        .map((item, index) => ({
          id: `${row.campaignId}-${item.type}-${index}`,
          campaignId: row.campaignId,
          campaignName: row.campaign?.name || "Bez názvu",
          type: item.type,
          label: eventLabel(item.type),
          at: new Date(item.at).toISOString(),
        }));

      timeline.push(...timelineEvents);
    }

    const openRate = rate(totals.opened, totals.delivered);
    const clickRate = rate(totals.clicked, totals.delivered);
    const submitRate = rate(totals.submitted, totals.submitEligible);
    const reportRate = rate(totals.reported, totals.delivered);
    const score = riskScore(clickRate, submitRate, reportRate);
    const bucket = riskBucket(score);

    res.json({
      schemaVersion: "1.2",
      userPublicId,
      period: { range, from: from.toISOString(), to: to.toISOString() },
      totals,
      rates: { openRate, clickRate, submitRate, reportRate },
      riskScore: score,
      riskBucket: bucket,
      riskLabel: riskLabel(bucket),
      lastEventAt: lastEventAt ? new Date(lastEventAt).toISOString() : null,
      profile: {
        ...(userShape || {}),
        campaignsTargeted: campaignHistory.length,
        avgReportTime: avgReportTimeLabel(reportSamples),
      },
      campaigns: campaignHistory,
      history: campaignHistory,
      timeline: timeline.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)),
      events: canonicalRows.map((row) => ({
        campaignId: row.campaignId,
        sentAt: toIso(row.sentAt),
        delivered: !!row.delivered,
        openedAt: toIso(row.openedAt),
        clickedAt: toIso(row.clickedAt),
        submittedAt: toIso(row.submittedAt),
        reportedAt: toIso(row.reportedAt),
      })),
    });
  } catch (error) {
    console.error("GET /api/reports/users/:userPublicId error", error);
    res.status(500).json({ error: error?.message || "Failed to load user detail" });
  }
});

export default router;
