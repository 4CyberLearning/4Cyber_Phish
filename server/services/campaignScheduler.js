import prisma from "../db/prisma.js";
import {
  CampaignLifecycleEventType,
  CampaignSource,
  CampaignStatus,
} from "@prisma/client";
import { sendCampaignNow } from "./campaignDispatch.js";
import { buildLifecycleEventData } from "./campaignLifecycle.js";

const enabled = String(process.env.CAMPAIGN_SCHEDULER_ENABLED || "true").toLowerCase() === "true";
const intervalMs = Math.max(Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 30000), 5000);
const inFlight = new Set();
let timer = null;
let tickRunning = false;

async function cancelExpiredScheduledCampaigns(now) {
  const due = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.SCHEDULED,
      cutoffAt: { lte: now },
    },
    select: { id: true, tenantId: true },
    orderBy: [{ cutoffAt: "asc" }, { id: "asc" }],
    take: 50,
  });

  for (const campaign of due) {
    const updated = await prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        tenantId: campaign.tenantId,
        status: CampaignStatus.SCHEDULED,
      },
      data: {
        status: CampaignStatus.CANCELLED,
        cancelledAt: now,
        statusReason: "cutoff_elapsed_before_start",
        finishReason: "cutoff_elapsed_before_start",
        source: CampaignSource.SCHEDULER,
      },
    });

    if (!updated.count) continue;

    await prisma.campaignLifecycleEvent.create({
      data: buildLifecycleEventData({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        type: CampaignLifecycleEventType.CANCELLED,
        actor: { source: "scheduler" },
        reason: "cutoff_elapsed_before_start",
        meta: { action: "cancel_expired_scheduled" },
        createdAt: now,
      }),
    });
  }
}

async function finishExpiredRunningCampaigns(now) {
  const due = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.RUNNING,
      cutoffAt: { lte: now },
    },
    select: { id: true, tenantId: true },
    orderBy: [{ cutoffAt: "asc" }, { id: "asc" }],
    take: 50,
  });

  for (const campaign of due) {
    const updated = await prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        tenantId: campaign.tenantId,
        status: CampaignStatus.RUNNING,
      },
      data: {
        status: CampaignStatus.FINISHED,
        finishedAt: now,
        finishReason: "cutoff_elapsed",
        statusReason: null,
        source: CampaignSource.SCHEDULER,
      },
    });

    if (!updated.count) continue;

    await prisma.campaignLifecycleEvent.create({
      data: buildLifecycleEventData({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        type: CampaignLifecycleEventType.FINISHED,
        actor: { source: "scheduler" },
        reason: "cutoff_elapsed",
        meta: { action: "finish_expired_running" },
        createdAt: now,
      }),
    });
  }
}

async function startDueScheduledCampaigns(now) {
  const due = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.SCHEDULED,
      scheduledAt: { lte: now },
      targetUsers: { some: {} },
      OR: [
        { cutoffAt: null },
        { cutoffAt: { gt: now } },
      ],
    },
    select: { id: true, tenantId: true, scheduledAt: true },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: 20,
  });

  for (const campaign of due) {
    if (inFlight.has(campaign.id)) continue;
    inFlight.add(campaign.id);

    try {
      const claimed = await prisma.campaign.updateMany({
        where: {
          id: campaign.id,
          tenantId: campaign.tenantId,
          status: CampaignStatus.SCHEDULED,
        },
        data: {
          status: CampaignStatus.RUNNING,
          startedAt: now,
          statusReason: "started_by_scheduler",
          source: CampaignSource.SCHEDULER,
        },
      });

      if (!claimed.count) continue;

      await prisma.campaignLifecycleEvent.create({
        data: buildLifecycleEventData({
          tenantId: campaign.tenantId,
          campaignId: campaign.id,
          type: CampaignLifecycleEventType.STARTED,
          actor: { source: "scheduler" },
          reason: "scheduled_at_reached",
          meta: { action: "start_due_scheduled" },
          createdAt: now,
        }),
      });

      const result = await sendCampaignNow(campaign.id, campaign.tenantId);
      console.log("[campaign-scheduler] sent", result);
    } catch (error) {
      console.error("[campaign-scheduler] failed", {
        campaignId: campaign.id,
        error: error?.message || String(error),
      });
    } finally {
      inFlight.delete(campaign.id);
    }
  }
}

async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  const now = new Date();

  try {
    await cancelExpiredScheduledCampaigns(now);
    await startDueScheduledCampaigns(now);
    await finishExpiredRunningCampaigns(now);
  } finally {
    tickRunning = false;
  }
}

export function startCampaignScheduler() {
  if (!enabled) {
    console.log("[campaign-scheduler] disabled");
    return;
  }
  if (timer) return;

  timer = setInterval(() => {
    tick().catch((error) => {
      console.error("[campaign-scheduler] tick error", error);
    });
  }, intervalMs);

  console.log(`[campaign-scheduler] started interval=${intervalMs}ms`);
  setTimeout(() => {
    tick().catch((error) => {
      console.error("[campaign-scheduler] initial tick error", error);
    });
  }, 2000);
}
