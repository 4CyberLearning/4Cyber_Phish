import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaignReport } from "../api/campaigns";

function formatDate(value) {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString();
}

function MetricCard({ label, value, rate }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-sm">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">
        {value ?? 0}
      </div>
      {typeof rate === "number" && (
        <div className="mt-1 text-[11px] text-gray-500">{rate}%</div>
      )}
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCampaignReport(id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setError(e.message || "Nepodařilo se načíst kampaň");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/campaigns")}
            className="mb-2 text-xs text-[var(--brand-strong)] hover:underline"
          >
            ← Zpět na kampaně
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {data?.name || "Detail kampaně"}
          </h1>
          {data?.description && (
            <p className="mt-1 text-sm text-gray-500">{data.description}</p>
          )}
          {data && (
            <p className="mt-1 text-xs text-gray-500">
              Šablona:{" "}
              <span className="font-medium">
                {data.emailTemplate?.name || "-"}
              </span>{" "}
              · Landing page:{" "}
              <span className="font-medium">
                {data.landingPage?.name || "-"}
              </span>
            </p>
          )}
        </div>
        {data && (
          <div className="text-right text-xs text-gray-500">
            <div>
              ID kampaně: <span className="font-mono">{data.id}</span>
            </div>
            <div>
              Plán:{" "}
              <span className="font-medium">
                {data.scheduledAt ? formatDate(data.scheduledAt) : "-"}
              </span>
            </div>
            <div>
              Stav: <span className="font-medium">{data.status}</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Načítání…</div>
      ) : !data ? (
        <div className="text-sm text-gray-500">Kampaň nenalezena.</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard
              label="Příjemci"
              value={metrics.totalRecipients}
            />
            <MetricCard
              label="Odesláno"
              value={metrics.sent}
              rate={metrics.sentRate}
            />
            <MetricCard
              label="Otevřeno"
              value={metrics.opened}
              rate={metrics.openRate}
            />
            <MetricCard
              label="Kliknuto"
              value={metrics.clicked}
              rate={metrics.clickRate}
            />
            <MetricCard
              label="Vyplněn formulář"
              value={metrics.submitted}
              rate={metrics.submitRate}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Příjemci a interakce
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left font-medium">E-mail</th>
                    <th className="p-2 text-left font-medium">Jméno</th>
                    <th className="p-2 text-left font-medium">Oddělení</th>
                    <th className="p-2 text-left font-medium">Role</th>
                    <th className="p-2 text-left font-medium">Odesláno</th>
                    <th className="p-2 text-left font-medium">Otevřeno</th>
                    <th className="p-2 text-left font-medium">Kliknuto</th>
                    <th className="p-2 text-left font-medium">
                      Formulář
                    </th>
                    <th className="p-2 text-left font-medium">
                      Nahlášeno
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="p-2">{r.email}</td>
                      <td className="p-2">{r.fullName || "–"}</td>
                      <td className="p-2">{r.department || "–"}</td>
                      <td className="p-2">{r.role || "–"}</td>
                      <td className="p-2">{formatDate(r.sentAt)}</td>
                      <td className="p-2">{formatDate(r.openedAt)}</td>
                      <td className="p-2">{formatDate(r.clickedAt)}</td>
                      <td className="p-2">{formatDate(r.submittedAt)}</td>
                      <td className="p-2">{formatDate(r.reportedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
