import { useEffect, useMemo, useState } from "react";
import { useCurrentCampaign } from "../../hooks/useCurrentCampaign";
import { getCampaignReport } from "../../api/campaignReports";

function fmtDt(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function pct(n, d) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default function ReportsOverviewPage() {
  const { hasCampaign, campaignId, campaign } = useCurrentCampaign();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totals = data?.totals || null;

  const rows = useMemo(() => {
    const list = Array.isArray(data?.recipients) ? data.recipients : [];
    return list.map((r) => {
      const status = r.reportedAt
        ? "Nahlášeno"
        : r.submittedAt
        ? "Vyplněno"
        : r.clickedAt
        ? "Klik"
        : r.openedAt
        ? "Otevřeno"
        : r.sentAt
        ? "Odesláno"
        : "—";
      return { ...r, status };
    });
  }, [data]);

  async function load() {
    if (!hasCampaign) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCampaignReport(Number(campaignId));
      setData(res);
    } catch (e) {
      setData(null);
      setError(e?.message || "Nepodařilo se načíst reporting.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCampaign, campaignId]);

  if (!hasCampaign) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Reporting</h1>
        <p className="mt-2 text-sm text-gray-600">
          Nejdřív vyber kampaň v horním panelu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reporting</h1>
            <div className="mt-1 text-xs text-gray-600">
              Kampaň:{" "}
              <span className="font-semibold text-gray-900">
                {campaign?.name || `#${campaignId}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
          >
            {loading ? "Načítám…" : "Obnovit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] text-gray-500">Příjemci</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            {totals?.totalRecipients ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] text-gray-500">Odesláno</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            {totals?.sent ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] text-gray-500">Otevřeno</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            {totals?.opened ?? "—"}{" "}
            <span className="text-xs text-gray-500">
              ({pct(totals?.opened || 0, totals?.sent || 0)})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] text-gray-500">Klik</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            {totals?.clicked ?? "—"}{" "}
            <span className="text-xs text-gray-500">
              ({pct(totals?.clicked || 0, totals?.sent || 0)})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="text-[11px] text-gray-500">Vyplněno (LP)</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">
            {totals?.submitted ?? "—"}{" "}
            <span className="text-xs text-gray-500">
              ({pct(totals?.submitted || 0, totals?.sent || 0)})
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Příjemci</h2>
          <div className="text-[11px] text-gray-500">{rows.length} položek</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-gray-200 text-[11px] text-gray-600">
              <tr>
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Jméno</th>
                <th className="py-2 pr-3">Stav</th>
                <th className="py-2 pr-3">Odesláno</th>
                <th className="py-2 pr-3">Otevřeno</th>
                <th className="py-2 pr-3">Klik</th>
                <th className="py-2 pr-3">Vyplněno</th>
                <th className="py-2 pr-3">Nahlášeno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[11px] text-gray-500">
                    Zatím žádná data.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.userId} className="hover:bg-gray-50">
                    <td className="py-2 pr-3 font-mono text-[11px] text-gray-900">
                      {r.email || "—"}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{r.fullName || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[11px] text-gray-700">{fmtDt(r.sentAt)}</td>
                    <td className="py-2 pr-3 text-[11px] text-gray-700">{fmtDt(r.openedAt)}</td>
                    <td className="py-2 pr-3 text-[11px] text-gray-700">{fmtDt(r.clickedAt)}</td>
                    <td className="py-2 pr-3 text-[11px] text-gray-700">{fmtDt(r.submittedAt)}</td>
                    <td className="py-2 pr-3 text-[11px] text-gray-700">{fmtDt(r.reportedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Interakce (log)</h2>
          <div className="text-[11px] text-gray-500">
            {Array.isArray(data?.interactions) ? data.interactions.length : 0} událostí
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-white border-b border-gray-200 text-[11px] text-gray-600">
              <tr>
                <th className="py-2 px-2">Čas</th>
                <th className="py-2 px-2">Typ</th>
                <th className="py-2 px-2">Uživatel</th>
                <th className="py-2 px-2">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(Array.isArray(data?.interactions) ? data.interactions : []).map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="py-2 px-2 text-[11px] text-gray-700">{fmtDt(it.createdAt)}</td>
                  <td className="py-2 px-2 text-[11px] font-semibold text-gray-900">{it.type}</td>
                  <td className="py-2 px-2 text-[11px] font-mono text-gray-700">
                    {it.userEmail || it.userId || "—"}
                  </td>
                  <td className="py-2 px-2 text-[11px] text-gray-700">
                    <pre className="whitespace-pre-wrap break-words">
                      {it.meta ? JSON.stringify(it.meta) : ""}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}