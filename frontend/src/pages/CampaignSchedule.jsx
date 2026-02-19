import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaign, updateCampaign } from "../api/campaigns";

// Musí odpovídat Topbar.jsx
const SCHEDULE_KEY = "campaign.schedule.v1";

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
  } catch {
    // ignore
  }
}

function toDatetimeLocalValue(dateLike) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || Number.isNaN(d.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function splitDatetimeLocal(v) {
  if (!v) return { date: "", hh: "09", mi: "00" };
  const [date = "", time = ""] = String(v).split("T");
  const [hh = "09", mi = "00"] = time.split(":");
  return {
    date,
    hh: String(hh).padStart(2, "0"),
    mi: String(mi).padStart(2, "0"),
  };
}

function joinDatetimeLocal(date, hh, mi) {
  if (!date) return "";
  return `${date}T${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export default function CampaignSchedule() {
  const { id } = useParams();
  const navigate = useNavigate();
  const campaignId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [campaign, setCampaign] = useState(null);

  const stored = useMemo(() => {
    const all = readJson(SCHEDULE_KEY, {});
    return all[String(campaignId)] || null;
  }, [campaignId]);

  const [sendDate, setSendDate] = useState("");
  const [sendHour, setSendHour] = useState("09");
  const [sendMinute, setSendMinute] = useState("00");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(campaignId)) {
      setLoading(false);
      setError("Neplatné ID kampaně.");
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampaign(campaignId);
        if (!alive) return;
        setCampaign(data);

        const initial = stored?.scheduledAt || data?.scheduledAt;
        const local = toDatetimeLocalValue(initial);
        const parts = splitDatetimeLocal(local);

        setSendDate(parts.date);
        setSendHour(parts.hh);
        setSendMinute(parts.mi);

        setDone(!!stored?.done);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Nepodařilo se načíst kampaň.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [campaignId, stored]);

  async function handleSave() {
    if (!Number.isInteger(campaignId)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const local = joinDatetimeLocal(sendDate, sendHour, sendMinute);
      const iso = local ? new Date(local).toISOString() : null;

      if (!iso || Number.isNaN(new Date(iso).getTime())) {
        setError("Vyplň datum a čas (časové okno).");
        return;
      }

      await updateCampaign(campaignId, { scheduledAt: iso });

      const all = readJson(SCHEDULE_KEY, {});
      all[String(campaignId)] = { done: true, scheduledAt: iso };
      writeJson(SCHEDULE_KEY, all);
      window.dispatchEvent(new CustomEvent("campaign:updated", { detail: { id: String(campaignId), step: "schedule" } }));
      setDone(true);
      setSuccess("Časová okna byla uložena.");
    } catch (e) {
      setError(e?.message || "Nepodařilo se uložit časová okna.");
    } finally {
      setSaving(false);
    }
  }

  function markNotDone() {
    const all = readJson(SCHEDULE_KEY, {});
    all[String(campaignId)] = { ...(all[String(campaignId)] || {}), done: false };
    writeJson(SCHEDULE_KEY, all);
    setDone(false);
    setSuccess("Krok byl označen jako nedokončený.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Časová okna</h1>
            <p className="mt-1 text-xs text-gray-600 max-w-2xl">
              Nastavení kdy se má kampaň odeslat. Zatím jde o jednoduché "odeslat v" (1 datum a čas).
            </p>
            {campaign?.name && (
              <div className="mt-2 text-xs text-gray-500">
                Kampaň: <span className="font-semibold text-gray-700">{campaign.name}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/campaigns/${campaignId}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Zpět na rekapitulaci
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-gray-500">Načítám…</div>
        ) : (
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Odeslat v</label>
                <div className="grid gap-2 sm:grid-cols-[1fr,120px,120px]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Datum</label>
                    <input
                      type="date"
                      value={sendDate}
                      onChange={(e) => setSendDate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Hodina</label>
                    <select
                      value={sendHour}
                      onChange={(e) => setSendHour(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                    >
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Minuta</label>
                    <select
                      value={sendMinute}
                      onChange={(e) => setSendMinute(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                    >
                      {Array.from({ length: 60 / 5 }, (_, i) => String(i * 5).padStart(2, "0")).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              <div className="mt-1 text-[11px] text-gray-500">Čas je v lokální časové zóně prohlížeče.</div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {saving ? "Ukládám…" : "Uložit časová okna"}
              </button>

              <div className="flex items-center gap-2">
                {done ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    Hotovo
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                    Nehotovo
                  </span>
                )}
                <button
                  type="button"
                  onClick={markNotDone}
                  disabled={saving}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Označit jako nehotovo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}