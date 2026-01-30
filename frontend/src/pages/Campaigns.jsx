import { useEffect, useMemo, useState } from "react";
import { useRouteTransition } from "../transition/RouteTransition";
import { listCampaigns } from "../api/campaigns";

export default function Campaigns() {
  const { start } = useRouteTransition();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const camps = await listCampaigns();
        setCampaigns(Array.isArray(camps) ? camps : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const campaignStats = useMemo(() => {
    const stats = { total: campaigns.length, scheduled: 0, active: 0, finished: 0 };
    for (const c of campaigns) {
      const s = (c.status || "").toUpperCase();
      if (s === "SCHEDULED") stats.scheduled += 1;
      else if (s === "ACTIVE") stats.active += 1;
      else if (s === "FINISHED" || s === "COMPLETED") stats.finished += 1;
    }
    return stats;
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let data = campaigns;

    if (statusFilter !== "ALL") {
      data = data.filter(
        (c) => (c.status || "").toUpperCase() === statusFilter
      );
    }

    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((c) => {
      const sender = formatSender(c.senderIdentity);
      const haystack = [
        c.name,
        c.description,
        c.emailTemplate?.name,
        c.landingPage?.name,
        sender,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [campaigns, statusFilter, search]);

  const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
  const CAMPAIGN_SELECTED_EVENT = "campaign:selected";

  function handleManage(id) {
    const strId = String(id);
    localStorage.setItem(SELECTED_CAMPAIGN_KEY, strId);
    window.dispatchEvent(new CustomEvent(CAMPAIGN_SELECTED_EVENT, { detail: { id: strId } }));
    start(`/campaigns/${id}`);
  }

  async function handleSendNow(id) {
    setError(null);
    setSendingId(id);
    try {
      await sendCampaignNow(id);
      const camps = await listCampaigns();
      setCampaigns(Array.isArray(camps) ? camps : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to send campaign");
    } finally {
      setSendingId(null);
    }
  }

  async function handleSendTest(id) {
    const to = window.prompt(
      "Zadej testovací e-mail, kam poslat ukázku této kampaně:"
    );
    if (!to) return;

    setError(null);
    setTestingId(id);

    try {
      await sendCampaignTest(id, to);
    } catch (e) {
      console.error(e);
      setError(
        e.message || "Testovací e-mail se nepodařilo odeslat"
      );
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hlavička + statistiky + CTA */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Phishingové kampaně
            </h1>
            <p className="mt-1 text-xs text-gray-500 max-w-2xl">
              Přehled všech kampaní, jejich stavu a hlavních parametrů.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-gray-500">
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px]">
                Kampaně:{" "}
                <span className="font-semibold">{campaignStats.total}</span>
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px]">
                Naplánované:{" "}
                <span className="font-semibold">
                  {campaignStats.scheduled}
                </span>
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px]">
                Probíhající:{" "}
                <span className="font-semibold">{campaignStats.active}</span>
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]">
                Dokončené:{" "}
                <span className="font-semibold">{campaignStats.finished}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate("/campaigns/new")}
              className="rounded-md bg-[var(--brand-strong)] px-4 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
            >
              Nová kampaň
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-white p-4 shadow-sm text-sm">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Přehled kampaní */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Přehled kampaní
            </h2>
            {loading && (
              <span className="mt-1 block text-xs text-gray-500">
                Načítání…
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
              placeholder="Hledat název, šablonu, odesílatele…"
            />
            <div className="flex flex-wrap gap-1">
              {[
                { key: "ALL", label: "Vše" },
                { key: "SCHEDULED", label: "Naplánované" },
                { key: "ACTIVE", label: "Probíhající" },
                { key: "FINISHED", label: "Dokončené" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={
                    "rounded-full border px-2 py-0.5 text-[11px] " +
                    (statusFilter === opt.key
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-sm text-gray-500">
            Zatím žádné kampaně. Vytvoř první přes „Nová kampaň“, nebo uprav filtr.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2 text-left font-medium text-gray-700">
                    Název
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Odesílatel
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Šablona
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Landing page
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Příjemci
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Plán
                  </th>
                  <th className="p-2 text-left font-medium text-gray-700">
                    Status
                  </th>
                  <th className="p-2 text-right font-medium text-gray-700">
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => {
                  const recipientsCount =
                    (Array.isArray(c.targetUsers) && c.targetUsers.length) ||
                    c.recipientCount ||
                    c.userCount ||
                    0;

                  return (
                    <tr key={c.id} className="border-b last:border-b-0">
                      <td className="p-2 align-top">
                        <div className="font-medium text-gray-900">
                          {c.name}
                        </div>
                        {c.description && (
                          <div className="mt-0.5 text-[11px] text-gray-500">
                            {c.description}
                          </div>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        {formatSender(c.senderIdentity)}
                      </td>
                      <td className="p-2 align-top">
                        {c.emailTemplate?.name || "-"}
                      </td>
                      <td className="p-2 align-top">
                        {c.landingPage?.name || "-"}
                      </td>
                      <td className="p-2 align-top">
                        {recipientsCount > 0 ? recipientsCount : "-"}
                      </td>
                      <td className="p-2 align-top">
                        {c.scheduledAt
                          ? new Date(c.scheduledAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-2 align-top">
                        <span
                          className={
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] " +
                            statusBadgeClasses(c.status)
                          }
                        >
                          {formatStatus(c.status)}
                        </span>
                      </td>
                      <td className="p-2 align-top text-right">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleManage(c.id)}
                            className="rounded-md border border-[var(--brand-strong)] px-3 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                          >
                            Spravovat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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

function formatStatus(status) {
  const s = (status || "SCHEDULED").toUpperCase();
  if (s === "ACTIVE") return "Probíhá";
  if (s === "FINISHED" || s === "COMPLETED") return "Dokončená";
  if (s === "DRAFT") return "Draft";
  if (s === "FAILED") return "Chyba";
  return "Naplánovaná";
}

function statusBadgeClasses(status) {
  const s = (status || "SCHEDULED").toUpperCase();
  if (s === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "FINISHED" || s === "COMPLETED")
    return "border-slate-200 bg-slate-50 text-slate-700";
  if (s === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
