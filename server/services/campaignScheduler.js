import prisma from "../db/prisma.js";
import { CampaignStatus } from "@prisma/client";
import { sendCampaignNow } from "./campaignDispatch.js";

const enabled = String(process.env.CAMPAIGN_SCHEDULER_ENABLED || "true").toLowerCase() === "true";
const intervalMs = Math.max(Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 30000), 5000);
const inFlight = new Set();
let timer = null;
let tickRunning = false;

async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const due = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: { lte: new Date() },
        targetUsers: { some: {} },
      },
      select: { id: true, tenantId: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    });

    for (const campaign of due) {
      if (inFlight.has(campaign.id)) continue;
      inFlight.add(campaign.id);
      try {
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
