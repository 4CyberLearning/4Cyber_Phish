import { useCallback, useEffect, useMemo, useState } from "react";
import { getCampaign } from "../api/campaigns";

const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
const CAMPAIGN_CHANGED_EVENT = "campaign:changed";
const CAMPAIGN_UPDATED_EVENT = "campaign:updated";
const CAMPAIGN_SELECTED_EVENT = "campaign:selected";
const NONE_ID = "__none__";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSelectedCampaignId() {
  const raw = safeGet(SELECTED_CAMPAIGN_KEY) || "";
  return raw === NONE_ID ? "" : String(raw);
}

function isValidCampaignId(id) {
  return !!id && id !== NONE_ID;
}

export function useCurrentCampaign() {
  const [campaignId, setCampaignId] = useState(() => readSelectedCampaignId());
  const hasCampaign = useMemo(() => isValidCampaignId(campaignId), [campaignId]);

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasCampaign) {
      setCampaign(null);
      return;
    }

    const idNum = Number(campaignId);
    if (!Number.isInteger(idNum)) {
      setCampaign(null);
      return;
    }

    setLoading(true);
    try {
      const data = await getCampaign(idNum);
      setCampaign(data);
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, hasCampaign]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const setFromAnyId = (id) => {
      const next = String(id || "");
      setCampaignId(next === NONE_ID ? "" : next);
    };

    const onChanged = (e) => setFromAnyId(e?.detail?.id);
    const onSelected = (e) => setFromAnyId(e?.detail?.id);

    const onUpdated = (e) => {
      const id = String(e?.detail?.id ?? "");
      if (!id || id !== String(campaignId)) return;
      refresh();
    };

    const onStorage = (ev) => {
      if (ev.key !== SELECTED_CAMPAIGN_KEY) return;
      const next = String(ev.newValue || "");
      setCampaignId(next === NONE_ID ? "" : next);
    };

    window.addEventListener(CAMPAIGN_CHANGED_EVENT, onChanged);
    window.addEventListener(CAMPAIGN_SELECTED_EVENT, onSelected);
    window.addEventListener(CAMPAIGN_UPDATED_EVENT, onUpdated);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(CAMPAIGN_CHANGED_EVENT, onChanged);
      window.removeEventListener(CAMPAIGN_SELECTED_EVENT, onSelected);
      window.removeEventListener(CAMPAIGN_UPDATED_EVENT, onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [campaignId, refresh]);

  return { campaignId, hasCampaign, campaign, loading, refresh };
}
