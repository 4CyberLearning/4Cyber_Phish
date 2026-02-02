import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaign } from "../api/campaigns";
import {
  PREFLIGHT_ITEMS,
  PREFLIGHT_LEAD,
  PREFLIGHT_NOTE,
  PREFLIGHT_TITLE,
} from "./CampaignPreflightContent";

const STORE_KEY = "campaign.preflight.v1";
const CAMPAIGN_UPDATED_EVENT = "campaign:updated";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function groupItems(items) {
  const map = new Map();
  for (const it of items) {
    const k = it.owner || "Další";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return Array.from(map.entries());
}

function PrettyCheckbox({ checked, title, description, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        "group relative w-full rounded-xl border p-3 text-left transition hover:shadow-sm " +
        (checked
          ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_rgba(46,36,211,0.25),0_0_16px_rgba(71,101,238,0.18)]"
          : "border-gray-200 bg-white hover:border-[var(--brand-strong)]")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border transition " +
            (checked
              ? "border-[var(--brand-strong)] bg-[var(--brand-strong)] text-white"
              : "border-gray-300 bg-white text-transparent group-hover:border-[var(--brand-strong)]")
          }
          aria-hidden
        >
          ✓
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          {description && (
            <div className="mt-0.5 text-xs text-gray-600">{description}</div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function CampaignPreflight() {
  const { id } = useParams();
  const navigate = useNavigate();

  const campaignId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [campaign, setCampaign] = useState(null);
  const [checkedById, setCheckedById] = useState({});

  useEffect(() => {
    if (!campaignId) return;

    const all = readJson(STORE_KEY, {});
    const saved = all[String(campaignId)]?.items || {};
    setCheckedById(saved);

    let cancelled = false;
    (async () => {
      try {
        const data = await getCampaign(campaignId);
        if (!cancelled) setCampaign(data);
      } catch {
        if (!cancelled) setCampaign(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const doneCount = useMemo(() => {
    return PREFLIGHT_ITEMS.filter((it) => !!checkedById[it.id]).length;
  }, [checkedById]);

  const allDone = doneCount === PREFLIGHT_ITEMS.length && PREFLIGHT_ITEMS.length > 0;

  useEffect(() => {
    if (!campaignId) return;

    const all = readJson(STORE_KEY, {});
    const nextBucket = {
      items: checkedById,
      done: allDone,
      updatedAt: Date.now(),
    };
    writeJson(STORE_KEY, { ...all, [String(campaignId)]: nextBucket });

    if (allDone) {
      window.dispatchEvent(
        new CustomEvent(CAMPAIGN_UPDATED_EVENT, {
          detail: { id: String(campaignId), step: "preflight" },
        })
      );
    }
  }, [campaignId, checkedById, allDone]);

  function toggleItem(itemId) {
    setCheckedById((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  const groups = useMemo(() => groupItems(PREFLIGHT_ITEMS), []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{PREFLIGHT_TITLE}</h1>
            <p className="mt-1 text-xs text-gray-500 max-w-2xl">{PREFLIGHT_LEAD}</p>
            {campaign?.name && (
              <div className="mt-2 text-xs text-gray-600">
                Aktuální kampaň: <span className="font-semibold text-gray-900">{campaign.name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-gray-600">
              Splněno: <span className="font-semibold text-gray-900">{doneCount}</span> / {PREFLIGHT_ITEMS.length}
            </div>
            <div
              className={
                "rounded-full border px-3 py-1 text-[11px] font-medium " +
                (allDone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700")
              }
            >
              {allDone ? "Připraveno" : "Rozpracováno"}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {PREFLIGHT_NOTE}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/users")}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Zpět na příjemce
          </button>
          {campaignId && (
            <button
              type="button"
              onClick={() => navigate(`/campaigns/${campaignId}`)}
              className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-soft-dark)]"
            >
              Pokračovat na kontrolu →
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map(([owner, items]) => (
          <div key={owner} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">{owner}</div>
              <div className="text-[11px] text-gray-500">
                {items.filter((it) => !!checkedById[it.id]).length} / {items.length}
              </div>
            </div>

            <div className="space-y-2">
              {items.map((it) => (
                <PrettyCheckbox
                  key={it.id}
                  checked={!!checkedById[it.id]}
                  title={it.title}
                  description={it.description}
                  onToggle={() => toggleItem(it.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
