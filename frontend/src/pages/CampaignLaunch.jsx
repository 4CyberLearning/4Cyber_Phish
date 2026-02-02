import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaign, sendCampaignNow } from "../api/campaigns";

const PREFLIGHT_KEY = "campaign.preflight.v1";
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

function readPreflightDone(campaignId) {
  if (!campaignId) return false;
  const all = readJson(PREFLIGHT_KEY, {});
  return !!all[String(campaignId)]?.done;
}

function recipientsCount(c) {
  if (!c) return 0;
  if (Array.isArray(c.targetUsers)) return c.targetUsers.length;
  return 0;
}

function formatSender(identity) {
  if (!identity) return "Výchozí odesílatel";
  const local = identity.localPart;
  const domain = identity.senderDomain?.domain;
  const email = local && domain ? `${local}@${domain}` : null;
  if (identity.fromName && email) return `${identity.fromName} <${email}>`;
  if (email) return email;
  return identity.fromName || "Výchozí odesílatel";
}

function statusLabel(status) {
  const s = (status || "SCHEDULED").toUpperCase();
  if (s === "ACTIVE") return "Probíhá";
  if (s === "FINISHED" || s === "COMPLETED") return "Dokončená";
  if (s === "CANCELED") return "Zrušená";
  return "Naplánovaná";
}

function statusBadgeClasses(status) {
  const s = (status || "SCHEDULED").toUpperCase();
  if (s === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "FINISHED" || s === "COMPLETED") return "border-slate-200 bg-slate-50 text-slate-700";
  if (s === "CANCELED") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function CheckLine({ ok, label, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-900">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-600">{detail}</div>
      </div>
      <span
        className={[
          "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
        ].join(" ")}
      >
        {ok ? "OK" : "Chybí"}
      </span>
    </div>
  );
}

export default function CampaignLaunch() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const cid = Number(id);
    if (!cid || Number.isNaN(cid)) {
      setError("Invalid id");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampaign(cid);
        if (!cancelled) setCampaign(data);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Nepodařilo se načíst kampaň");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const recCount = useMemo(() => recipientsCount(campaign), [campaign]);
  const preflightDone = useMemo(() => readPreflightDone(campaign?.id), [campaign?.id]);

  const senderLine = useMemo(() => formatSender(campaign?.senderIdentity), [campaign?.senderIdentity]);

  const status = (campaign?.status || "SCHEDULED").toUpperCase();
  const alreadySent = status === "ACTIVE" || status === "FINISHED" || status === "COMPLETED" || status === "CANCELED";

  const okEmail = !!campaign?.emailTemplateId;
  const okLanding = !!campaign?.landingPageId;
  const okSender = !!campaign?.senderIdentityId; // volitelné, ale ukazujeme jako kontrolu
  const okRecipients = recCount > 0;
  const okPreflight = preflightDone;

  const canSend = okEmail && okLanding && okRecipients && okPreflight && !alreadySent;

  async function handleSendNow() {
    if (!campaign?.id) return;
    setError(null);
    setSuccess(null);

    if (!canSend) {
      setError("Nelze spustit: doplň chybějící kroky (nebo kampaň už běží/doběhla).");
      return;
    }

    const ok = window.confirm(
      `Opravdu spustit kampaň "${campaign.name}"?\n\nOdešle se ${recCount} e-mailů.`
    );
    if (!ok) return;

    setSending(true);
    try {
      await sendCampaignNow(campaign.id);
      window.dispatchEvent(new CustomEvent(CAMPAIGN_UPDATED_EVENT, { detail: { id: String(campaign.id) } }));

      const refreshed = await getCampaign(campaign.id);
      setCampaign(refreshed);

      setSuccess("Kampaň byla spuštěna (odesílání zahájeno).");
    } catch (e) {
      setError(e?.message || "Spuštění kampaně se nepodařilo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/campaigns/${id}`)}
          className="text-[11px] text-[var(--brand-strong)] hover:underline"
        >
          ← Zpět na kontrolu
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(`/campaigns/${id}/preflight`)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Příprava
          </button>
          <button
            type="button"
            onClick={() => navigate(`/campaigns/${id}`)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kontrola
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">Spuštění kampaně</h1>
            {campaign && (
              <div className="mt-1 text-xs text-gray-500 truncate">
                {campaign.name} · ID: {campaign.id}
              </div>
            )}
          </div>

          {campaign && (
            <span className={"inline-flex rounded-full border px-2 py-0.5 text-[11px] " + statusBadgeClasses(campaign.status)}>
              {statusLabel(campaign.status)}
            </span>
          )}
        </div>

        {loading && <div className="mt-3 text-sm text-gray-500">Načítám…</div>}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {campaign && !loading && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <CheckLine ok={okEmail} label="Email šablona" detail={campaign.emailTemplate?.name || "-"} />
              <CheckLine ok={okLanding} label="Landing page" detail={campaign.landingPage?.name || "-"} />
              <CheckLine ok={okSender} label="Odesílatel (volitelné)" detail={senderLine} />
              <CheckLine ok={okRecipients} label="Příjemci" detail={`${recCount} vybráno`} />
              <CheckLine ok={okPreflight} label="Příprava (checklist)" detail={okPreflight ? "hotovo" : "nedokončeno"} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <div className="font-semibold text-slate-900">Poznámka</div>
                <div className="mt-1">
                  Kampaň lze spustit pouze pokud jsou vybraní příjemci a je dokončená „Příprava“.
                </div>
              </div>
            </div>

            {alreadySent && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                Tato kampaň je ve stavu <span className="font-semibold">{statusLabel(status)}</span> – znovu spustit nejde.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate("/campaigns")}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Přehled kampaní
              </button>

              <button
                type="button"
                onClick={handleSendNow}
                disabled={!canSend || sending}
                className={[
                  "rounded-full px-5 py-2 text-[12px] font-semibold",
                  canSend && !sending
                    ? "bg-[var(--brand-strong)] text-white hover:opacity-90"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed",
                ].join(" ")}
                title={!canSend ? "Doplň chybějící kroky (příjemci + příprava) nebo kampaň už běží." : "Spustit kampaň"}
              >
                {sending ? "Spouštím…" : `Spustit kampaň (${recCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
