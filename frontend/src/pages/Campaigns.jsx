import { useEffect, useMemo, useState } from "react";
import { listTemplates } from "../api/templates";
import { listLandingPages } from "../api/landingPages";
import { listUsers, listGroups } from "../api/users";
import {
  listCampaigns,
  createCampaign,
  sendCampaignNow,
} from "../api/campaigns";
import { listSenderIdentities } from "../api/senderIdentities";
import { useNavigate } from "react-router-dom";

export default function Campaigns() {
  const navigate = useNavigate(); 
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [senderIdentities, setSenderIdentities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    emailTemplateId: "",
    landingPageId: "",
    senderIdentityId: "",
    scheduledAt: "",
    targetGroupIds: [],
    allUsers: true,
  });

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleGroup(id) {
    setForm((prev) => {
      const groupId = Number(id);
      if (!groupId) return prev;
      const exists = prev.targetGroupIds.includes(groupId);
      return {
        ...prev,
        targetGroupIds: exists
          ? prev.targetGroupIds.filter((g) => g !== groupId)
          : [...prev.targetGroupIds, groupId],
      };
    });
  }

  const selectedUserIds = useMemo(() => {
    if (form.allUsers) {
      return users.map((u) => u.id);
    }
    if (!form.targetGroupIds.length) return [];
    const set = new Set();
    for (const u of users) {
      const userGroupIds = (u.groups || []).map((g) => g.id);
      if (userGroupIds.some((gid) => form.targetGroupIds.includes(gid))) {
        set.add(u.id);
      }
    }
    return Array.from(set);
  }, [form.allUsers, form.targetGroupIds, users]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [tpls, lps, usrs, grps, camps, senders] = await Promise.all([
          listTemplates(),
          listLandingPages(),
          listUsers(),
          listGroups(),
          listCampaigns(),
          listSenderIdentities(),
        ]);
        setTemplates(Array.isArray(tpls) ? tpls : []);
        setPages(Array.isArray(lps) ? lps : []);
        setUsers(Array.isArray(usrs) ? usrs : []);
        setGroups(Array.isArray(grps) ? grps : []);
        setCampaigns(Array.isArray(camps) ? camps : []);
        setSenderIdentities(Array.isArray(senders) ? senders : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    const name = (form.name || "").trim();
    if (!name) {
      setError("Název kampaně je povinný.");
      return;
    }
    if (!form.emailTemplateId) {
      setError("Vyber e-mailovou šablonu.");
      return;
    }
    if (!form.landingPageId) {
      setError("Vyber landing page.");
      return;
    }
    if (!form.allUsers && !form.targetGroupIds.length) {
      setError("Vyber alespoň jednu skupinu nebo použij 'všichni uživatelé'.");
      return;
    }

    const userIds = selectedUserIds;
    if (!userIds.length) {
      setError("Podle nastavení neodpovídá žádný uživatel.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name,
        description: form.description || "",
        emailTemplateId: Number(form.emailTemplateId),
        landingPageId: Number(form.landingPageId),
        scheduledAt: form.scheduledAt || null,
        userIds,
      };

      if (form.senderIdentityId) {
        payload.senderIdentityId = Number(form.senderIdentityId);
      }

      const created = await createCampaign(payload);

      setCampaigns((prev) => [created, ...prev]);
      setForm({
        name: "",
        description: "",
        emailTemplateId: "",
        landingPageId: "",
        senderIdentityId: "",
        scheduledAt: "",
        targetGroupIds: [],
        allUsers: true,
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
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

  function formatSender(identity) {
    if (!identity) return "Výchozí odesílatel";

    const local = identity.localPart;
    const domain = identity.senderDomain?.domain;
    const email =
      local && domain ? `${local}@${domain}` : null;

    if (identity.fromName && email) {
      return `${identity.fromName} <${email}>`;
    }
    if (email) return email;
    return identity.fromName || "Výchozí odesílatel";
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Phishingové kampaně
            </h1>
            <p className="mt-1 text-xs text-gray-500 max-w-2xl">
              Sestav kampaň výběrem šablony, landing page, odesílací identity a
              cílových uživatelů. Odesílání nyní používá testovací SMTP.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Vybráno uživatelů:{" "}
            <span className="font-semibold text-gray-800">
              {selectedUserIds.length}
            </span>
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Název kampaně
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="Např. CFO spear-phishing"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Datum a čas rozeslání
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setField("scheduledAt", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Popis / poznámka
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                placeholder="Interní poznámka pro reporty…"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  E-mailová šablona
                </label>
                <select
                  value={form.emailTemplateId}
                  onChange={(e) => setField("emailTemplateId", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                >
                  <option value="">– vyber šablonu –</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Landing page
                </label>
                <select
                  value={form.landingPageId}
                  onChange={(e) => setField("landingPageId", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                >
                  <option value="">– vyber landing page –</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Odesílací identita
                </label>
                <select
                  value={form.senderIdentityId}
                  onChange={(e) =>
                    setField("senderIdentityId", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                >
                  <option value="">
                    – výchozí odesílatel (SMTP_FROM ze serveru) –
                  </option>
                  {senderIdentities.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSender(s)}
                      {s.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">
                  Cílové skupiny
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.allUsers}
                    onChange={(e) => setField("allUsers", e.target.checked)}
                  />
                  Všichni uživatelé
                </label>
              </div>

              {!form.allUsers && (
                <div className="flex flex-wrap gap-2">
                  {groups.length === 0 ? (
                    <span className="text-xs text-gray-500">
                      Zatím nemáš žádné skupiny. Vytvoř je v sekci Uživatelé.
                    </span>
                  ) : (
                    groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className={
                          "rounded-full border px-3 py-1 text-xs " +
                          (form.targetGroupIds.includes(g.id)
                            ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50")
                        }
                      >
                        {g.name}{" "}
                        {typeof g.memberCount === "number" &&
                          `(${g.memberCount})`}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={creating || loading}
                className="rounded-md bg-[var(--brand-strong)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                Vytvořit kampaň
              </button>
              <div className="text-[11px] text-gray-500">
                Po vytvoření můžeš kampaň spustit ručně přes „Odeslat teď“.
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Přehled kampaní
            </h2>
            {loading && (
              <span className="text-xs text-gray-500">Načítání…</span>
            )}
          </div>

          {campaigns.length === 0 ? (
            <div className="text-sm text-gray-500">
              Zatím žádné kampaně. Vytvoř první v levé části.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {campaigns.map((c) => (
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
                        {c.scheduledAt
                          ? new Date(c.scheduledAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-2 align-top">
                        {c.status || "SCHEDULED"}
                      </td>
                      <td className="p-2 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/campaigns/${c.id}`)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendNow(c.id)}
                            disabled={sendingId === c.id}
                            className="rounded-md border border-[var(--brand-strong)] px-3 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                          >
                            {sendingId === c.id ? "Odesílám…" : "Odeslat teď"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
