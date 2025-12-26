import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaign } from "../api/campaigns";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const numericId = Number(id);

    if (!numericId || Number.isNaN(numericId)) {
      setError("Invalid id");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampaign(numericId);
        if (!cancelled) {
          setCampaign(data);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(e.message || "Nepodařilo se načíst kampaň");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function formatSender(identity) {
    if (!identity) return "Výchozí odesílatel";
    const local = identity.localPart;
    const domain = identity.senderDomain?.domain;
    const email = local && domain ? `${local}@${domain}` : null;

    if (identity.fromName && email) {
      return `${identity.fromName} <${email}>`;
    }
    if (email) return email;
    return identity.fromName || "Výchozí odesílatel";
  }

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  const status = (campaign?.status || "").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/campaigns")}
          className="text-[11px] text-[var(--brand-strong)] hover:underline"
        >
          ← Zpět na kampaně
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Detail kampaně
        </h1>
        {campaign && (
          <p className="mt-1 text-xs text-gray-500 max-w-2xl">
            ID: {campaign.id} · vytvořeno{" "}
            {formatDate(campaign.createdAt || campaign.created_at)}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="text-sm text-gray-500">Načítám kampaň…</div>
      )}

      {!loading && !campaign && !error && (
        <div className="text-sm text-gray-500">Kampaň nenalezena.</div>
      )}

      {campaign && !loading && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          {/* základní info */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Základní informace
            </h2>
            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  Název kampaně
                </div>
                <div className="text-sm text-gray-900">{campaign.name}</div>
              </div>

              {campaign.description && (
                <div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Popis
                  </div>
                  <div className="text-sm text-gray-900">
                    {campaign.description}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Stav
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] " +
                        statusBadgeClasses(status)
                      }
                    >
                      {formatStatus(status)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-500">
                    Plánované odeslání
                  </div>
                  <div className="text-sm text-gray-900">
                    {formatDate(campaign.scheduledAt || campaign.scheduled_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* obsah kampaně */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Obsah a odesílatel
            </h2>
            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  Odesílatel
                </div>
                <div className="text-sm text-gray-900">
                  {formatSender(campaign.senderIdentity)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  E-mailová šablona
                </div>
                <div className="text-sm text-gray-900">
                  {campaign.emailTemplate?.name || "-"}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-gray-500">
                  Landing page
                </div>
                <div className="text-sm text-gray-900">
                  {campaign.landingPage?.name || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatus(s) {
  const status = (s || "SCHEDULED").toUpperCase();
  if (status === "ACTIVE") return "Probíhá";
  if (status === "FINISHED" || status === "COMPLETED") return "Dokončená";
  if (status === "DRAFT") return "Draft";
  if (status === "FAILED") return "Chyba";
  return "Naplánovaná";
}

function statusBadgeClasses(s) {
  const status = (s || "SCHEDULED").toUpperCase();
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "FINISHED" || status === "COMPLETED") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  if (status === "FAILED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}
