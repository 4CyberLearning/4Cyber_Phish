import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCampaign } from "../api/campaigns";

const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
const CAMPAIGN_SELECTED_EVENT = "campaign:selected";
const PREFLIGHT_KEY = "campaign.preflight.v1";

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

function countRecipients(c) {
  if (!c) return 0;
  if (Array.isArray(c.targetUsers)) return c.targetUsers.length;
  return 0;
}

function buildDoc(kind, html) {
  const body = html || "";
  const base = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html,body{height:100%;margin:0}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,"Apple Color Emoji","Segoe UI Emoji";background:#f6f7fb}
    img{max-width:100%;height:auto}
    a{color:#2e24d3}
    .wrap{max-width:${kind === "email" ? "760px" : "1200px"};margin:16px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
    .pad{padding:16px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="pad">
      ${body}
    </div>
  </div>
</body>
</html>`;
  return base;
}

function PreviewModal({ open, title, doc, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 p-3 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-6xl rounded-2xl border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {title}
              </div>
              <div className="text-[11px] text-slate-500">Náhled</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Zavřít
            </button>
          </div>

          <div className="p-3">
            <iframe
              title={title}
              srcDoc={doc}
              sandbox="allow-forms allow-popups"
              className="h-[78vh] w-full rounded-xl border border-slate-200 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [preview, setPreview] = useState({ open: false, title: "", doc: "" });
  const [recipientQuery, setRecipientQuery] = useState("");

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
        if (!cancelled) setCampaign(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || "Nepodařilo se načíst kampaň");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const status = (campaign?.status || "").toUpperCase();
  const preflightDone = useMemo(() => readPreflightDone(campaign?.id), [campaign?.id]);

  function formatSender(identity) {
    if (!identity) return "Výchozí odesílatel";
    const local = identity.localPart;
    const domain = identity.senderDomain?.domain;
    const email = local && domain ? `${local}@${domain}` : null;

    if (identity.fromName && email) return `${identity.fromName} <${email}>`;
    if (email) return email;
    return identity.fromName || "Výchozí odesílatel";
  }

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  const recipients = useMemo(() => {
    const list = Array.isArray(campaign?.targetUsers) ? campaign.targetUsers : [];
    const q = recipientQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((cu) => {
      const u = cu.user || {};
      const hay = [u.email, u.fullName, u.department, u.role].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [campaign, recipientQuery]);

  const senderLine = useMemo(() => formatSender(campaign?.senderIdentity), [campaign?.senderIdentity]);

  const emailSubject = campaign?.emailTemplate?.subject || "-";
  const emailName = campaign?.emailTemplate?.name || "-";
  const emailDoc = useMemo(
    () => buildDoc("email", campaign?.emailTemplate?.bodyHtml || ""),
    [campaign?.emailTemplate?.bodyHtml]
  );

  const landingName = campaign?.landingPage?.name || "-";
  const landingSlug = campaign?.landingPage?.urlSlug || (campaign?.landingPageId ? String(campaign.landingPageId) : "");
  const landingDoc = useMemo(
    () => buildDoc("landing", campaign?.landingPage?.html || ""),
    [campaign?.landingPage?.html]
  );

  const recipientsCount = countRecipients(campaign);

  const okEmail = !!campaign?.emailTemplateId;
  const okLanding = !!campaign?.landingPageId;
  const okSender = !!campaign?.senderIdentityId; // může být null (default), ale pro “kontrolu” chceme vědět, jestli je vybraná
  const okTargets = recipientsCount > 0;

  function setAsCurrentCampaign() {
    if (!campaign?.id) return;
    const strId = String(campaign.id);
    localStorage.setItem(SELECTED_CAMPAIGN_KEY, strId);
    window.dispatchEvent(new CustomEvent(CAMPAIGN_SELECTED_EVENT, { detail: { id: strId } }));
  }

  return (
    <div className="space-y-6">
      <PreviewModal
        open={preview.open}
        title={preview.title}
        doc={preview.doc}
        onClose={() => setPreview({ open: false, title: "", doc: "" })}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/campaigns")}
          className="text-[11px] text-[var(--brand-strong)] hover:underline"
        >
          ← Zpět na kampaně
        </button>

        {campaign?.id && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate(`/campaigns/${campaign.id}/preflight`)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Příprava
            </button>
            <button
              type="button"
              onClick={() => navigate("/content/email-templates")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => navigate("/content/landing-pages")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Landing
            </button>
            <button
              type="button"
              onClick={() => navigate("/content/sender-identities")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Odesílatel
            </button>
            <button
              type="button"
              onClick={() => navigate("/users")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Příjemci
            </button>
            <button
              type="button"
              onClick={() => navigate(`/campaigns/${campaign.id}/launch`)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Spuštění
            </button>
            <button
              type="button"
              onClick={setAsCurrentCampaign}
              className="rounded-full border border-[var(--brand-strong)]/30 bg-[var(--brand-strong)]/5 px-3 py-1 text-[11px] font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
              title="Nastaví tuto kampaň jako aktuální v horním panelu"
            >
              Nastavit jako aktuální
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Kontrola kampaně</h1>
            {campaign && (
              <p className="mt-1 text-xs text-gray-500 max-w-2xl">
                ID: {campaign.id} · vytvořeno {formatDate(campaign.createdAt || campaign.created_at)}
              </p>
            )}
          </div>

          {campaign && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={"inline-flex rounded-full border px-2 py-0.5 text-[11px] " + statusBadgeClasses(status)}>
                {formatStatus(status)}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                Příjemci: <span className="font-semibold">{recipientsCount}</span>
              </span>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  preflightDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                ].join(" ")}
              >
                Příprava: {preflightDone ? "OK" : "Nedokončeno"}
              </span>
            </div>
          )}
        </div>

        {campaign && (
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <CheckPill ok={okEmail} label="Email" detail={emailName} />
            <CheckPill ok={okLanding} label="Landing" detail={landingName} />
            <CheckPill ok={okSender} label="Odesílatel" detail={senderLine} />
            <CheckPill ok={okTargets} label="Příjemci" detail={`${recipientsCount} vybráno`} />
            <CheckPill ok={preflightDone} label="Příprava" detail={preflightDone ? "hotovo" : "chybí"} />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !error && <div className="text-sm text-gray-500">Načítám kampaň…</div>}
      {!loading && !campaign && !error && <div className="text-sm text-gray-500">Kampaň nenalezena.</div>}

      {campaign && !loading && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            {/* EMAIL PREVIEW */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">Email</h2>
                  <div className="mt-1 text-[11px] text-gray-500 truncate">
                    Šablona: <span className="font-semibold text-gray-700">{emailName}</span> · Předmět:{" "}
                    <span className="font-semibold text-gray-700">{emailSubject}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview({ open: true, title: `Email · ${emailName}`, doc: emailDoc })}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Otevřít náhled
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px]">
                <div className="grid gap-1">
                  <div className="flex gap-2">
                    <span className="w-16 text-slate-500">From:</span>
                    <span className="font-semibold text-slate-800">{senderLine}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-16 text-slate-500">To:</span>
                    <span className="text-slate-700">[příjemce kampaně]</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-16 text-slate-500">Subject:</span>
                    <span className="font-semibold text-slate-800">{emailSubject}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <iframe
                  title="Email preview"
                  srcDoc={emailDoc}
                  sandbox="allow-forms allow-popups"
                  className="h-[420px] w-full rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* LANDING PREVIEW */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">Landing page</h2>
                  <div className="mt-1 text-[11px] text-gray-500 truncate">
                    Stránka: <span className="font-semibold text-gray-700">{landingName}</span>{" "}
                    {landingSlug ? (
                      <>
                        · Slug: <span className="font-semibold text-gray-700">{landingSlug}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview({ open: true, title: `Landing · ${landingName}`, doc: landingDoc })}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Otevřít náhled
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-slate-600">
                    URL (v aplikaci):
                    <span className="ml-2 font-semibold text-slate-800">{landingSlug ? `/lp/${landingSlug}` : "-"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <iframe
                  title="Landing preview"
                  srcDoc={landingDoc}
                  sandbox="allow-forms allow-popups"
                  className="h-[420px] w-full rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* SENDER */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Odesílatel</h2>

              <div className="mt-3 space-y-2 text-[12px]">
                <Row label="Zobrazení (From)" value={senderLine} strong />
                <Row label="Reply-To" value={campaign?.senderIdentity?.replyTo || "-"} />
                <Row label="Doména" value={campaign?.senderIdentity?.senderDomain?.domain || "-"} />
                <Row label="Local part" value={campaign?.senderIdentity?.localPart || "-"} />
                <Row label="Poznámka" value={campaign?.senderIdentity?.description || "-"} />
              </div>

              {!campaign?.senderIdentityId && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  Není vybraná odesílací identita – použije se výchozí odesílatel.
                </div>
              )}
            </div>

            {/* RECIPIENTS */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Příjemci</h2>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Vybráno: <span className="font-semibold text-gray-700">{recipientsCount}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/users")}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Otevřít příjemce
                </button>
              </div>

              <div className="mt-3">
                <input
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  placeholder="Hledat v příjemcích…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Jméno</th>
                        <th className="px-3 py-2 font-semibold">Odd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.length ? (
                        recipients.map((cu) => {
                          const u = cu.user || {};
                          return (
                            <tr key={cu.id} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-slate-800">{u.email || "-"}</td>
                              <td className="px-3 py-2 text-slate-700">{u.fullName || "-"}</td>
                              <td className="px-3 py-2 text-slate-700">{u.department || "-"}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-3 py-3 text-slate-500" colSpan={3}>
                            Nenalezen žádný příjemce.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {recipientsCount === 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  V kampani nejsou nastavení žádní příjemci.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-slate-500">{label}</div>
      <div className={"text-right " + (strong ? "font-semibold text-slate-900" : "text-slate-700")}>
        {value}
      </div>
    </div>
  );
}

function CheckPill({ ok, label, detail }) {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2",
        ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-slate-900">{label}</div>
        <span className={["text-[11px] font-semibold", ok ? "text-emerald-700" : "text-amber-700"].join(" ")}>
          {ok ? "OK" : "Chybí"}
        </span>
      </div>
      <div className="mt-1 truncate text-[11px] text-slate-700">{detail}</div>
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
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FINISHED" || status === "COMPLETED") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
