import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import { listGroups, createGroup, updateGroup, deleteGroup, createUser, updateUser, deleteUser } from "../api/users";
import { listGroupUsers, importUsersToGroup } from "../api/users";
import { setCampaignTargetsGroup } from "../api/campaigns";
import { useCurrentCampaign } from "../hooks/useCurrentCampaign";

const EMPTY_USER = {
  id: null,
  email: "",
  firstName: "",
  lastName: "",
  department: "",
  role: "",
  custom: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`custom${i + 1}`, ""])),
};

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function pickRowValue(row, key) {
  // row keys mohou být normalizované i originál
  const nkey = normalizeHeader(key);
  for (const k of Object.keys(row)) {
    if (normalizeHeader(k) === nkey) return row[k];
  }
  return undefined;
}

function toImportUser(row) {
  const email = String(pickRowValue(row, "email") ?? "").trim();
  const firstName =
    String(pickRowValue(row, "jmeno") ?? pickRowValue(row, "firstname") ?? "").trim();
  const lastName =
    String(pickRowValue(row, "prijmeni") ?? pickRowValue(row, "lastname") ?? "").trim();

  const custom = {};
  for (let i = 1; i <= 20; i++) {
    const v = pickRowValue(row, `custom${i}`);
    if (v !== undefined && v !== null && String(v).trim() !== "") custom[`custom${i}`] = String(v);
  }

  return {
    email,
    firstName,
    lastName,
    custom,
  };
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { hasCampaign, campaignId, campaign } = useCurrentCampaign();

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  // group users paging/search
  const [q, setQ] = useState("");
  const [take] = useState(50);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [groupUsers, setGroupUsers] = useState([]);

  // group edit/create
  const [groupMode, setGroupMode] = useState("view"); // view | create | edit
  const [groupName, setGroupName] = useState("");
  const groupInputRef = useRef(null);

  // user editor
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [showCustom, setShowCustom] = useState(false);

  // status
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [applyingCampaign, setApplyingCampaign] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const campaignGroupId = campaign?.targetGroupId ?? null;

  const sortedGroups = useMemo(() => {
    const arr = Array.isArray(groups) ? [...groups] : [];
    arr.sort((a, b) => {
      const aid = Number(a.id);
      const bid = Number(b.id);

      if (campaignGroupId && aid === Number(campaignGroupId)) return -1;
      if (campaignGroupId && bid === Number(campaignGroupId)) return 1;

      return String(a.name || "").localeCompare(String(b.name || ""), "cs");
    });
    return arr;
  }, [groups, campaignGroupId]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return groups.find((g) => Number(g.id) === Number(selectedGroupId)) || null;
  }, [groups, selectedGroupId]);

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // auto select: skupina z kampaně (pokud existuje), jinak první
    if (!selectedGroupId) {
      if (campaignGroupId) setSelectedGroupId(Number(campaignGroupId));
      else if (sortedGroups.length) setSelectedGroupId(Number(sortedGroups[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedGroups.length, campaignGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    loadGroupUsers({ resetSkip: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  async function loadGroups() {
    setLoadingGroups(true);
    setError(null);
    try {
      const g = await listGroups();
      setGroups(Array.isArray(g) ? g : []);
    } catch (e) {
      setError(e?.message || "Nepodařilo se načíst skupiny.");
    } finally {
      setLoadingGroups(false);
    }
  }

  async function loadGroupUsers({ resetSkip } = {}) {
    if (!selectedGroupId) return;
    setLoadingUsers(true);
    setError(null);
    try {
      const nextSkip = resetSkip ? 0 : skip;
      const data = await listGroupUsers(selectedGroupId, { take, skip: nextSkip, q });
      setGroupUsers(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      if (resetSkip) setSkip(0);
    } catch (e) {
      setError(e?.message || "Nepodařilo se načíst uživatele skupiny.");
    } finally {
      setLoadingUsers(false);
    }
  }

  function resetUserEditor() {
    setSelectedUserId(null);
    setUserForm(EMPTY_USER);
    setShowCustom(false);
  }

  function openCreateGroup() {
    setGroupMode("create");
    setGroupName("");
    setTimeout(() => groupInputRef.current?.focus(), 0);
  }

  function openEditGroup() {
    if (!selectedGroup) return;
    setGroupMode("edit");
    setGroupName(selectedGroup.name || "");
    setTimeout(() => groupInputRef.current?.focus(), 0);
  }

  function cancelGroupEdit() {
    setGroupMode("view");
    setGroupName("");
  }

  async function saveGroup(e) {
    e?.preventDefault?.();
    const name = String(groupName || "").trim();
    if (!name) {
      setError("Název skupiny je povinný.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (groupMode === "edit" && selectedGroup?.id) {
        await updateGroup(selectedGroup.id, { name });
        setSuccess("Skupina byla upravena.");
      } else {
        const created = await createGroup({ name });
        setSuccess("Skupina byla vytvořena.");
        if (created?.id) setSelectedGroupId(Number(created.id));
      }
      setGroupMode("view");
      await loadGroups();
    } catch (e2) {
      setError(e2?.message || "Nepodařilo se uložit skupinu.");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup() {
    if (!selectedGroup?.id) return;
    if (!window.confirm(`Opravdu chcete smazat skupinu "${selectedGroup.name}"?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteGroup(selectedGroup.id);
      setSuccess("Skupina byla smazána.");
      setSelectedGroupId(null);
      resetUserEditor();
      await loadGroups();
    } catch (e) {
      setError(e?.message || "Nepodařilo se smazat skupinu.");
    } finally {
      setSaving(false);
    }
  }

  async function applyGroupToCampaign() {
    if (!hasCampaign) {
      setError("Nejdřív vyber kampaň v horním panelu.");
      return;
    }
    if (!selectedGroup?.id) return;

    setApplyingCampaign(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await setCampaignTargetsGroup(Number(campaignId), Number(selectedGroup.id));
      window.dispatchEvent(new CustomEvent("campaign:updated", { detail: { id: String(campaignId) } }));
      setSuccess(`Skupina byla nastavena do kampaně (${r?.count ?? "OK"}).`);
      await loadGroups();
    } catch (e) {
      setError(e?.message || "Nepodařilo se nastavit skupinu do kampaně.");
    } finally {
      setApplyingCampaign(false);
    }
  }

  function selectUser(u) {
    setSelectedUserId(u.id);
    setUserForm({
      id: u.id,
      email: u.email || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      department: u.department || "",
      role: u.role || "",
      custom: {
        ...EMPTY_USER.custom,
        ...(u.custom && typeof u.custom === "object" ? u.custom : {}),
      },
    });
  }

  async function saveUser(e) {
    e?.preventDefault?.();
    if (!selectedGroup?.id) {
      setError("Nejdřív vyber skupinu.");
      return;
    }

    const email = String(userForm.email || "").trim().toLowerCase();
    if (!email) {
      setError("E-mail je povinný.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        email,
        firstName: String(userForm.firstName || "").trim(),
        lastName: String(userForm.lastName || "").trim(),
        department: String(userForm.department || "").trim(),
        role: String(userForm.role || "").trim(),
        custom: userForm.custom,
        groupIds: [Number(selectedGroup.id)], // primárně držíme usera ve vybrané skupině
      };

      if (userForm.id) await updateUser(userForm.id, payload);
      else await createUser(payload);

      setSuccess(userForm.id ? "Uživatel byl upraven." : "Uživatel byl přidán.");
      resetUserEditor();
      await loadGroupUsers();
      await loadGroups();
    } catch (e2) {
      setError(e2?.message || "Nepodařilo se uložit uživatele.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    if (!userForm.id) return;
    if (!window.confirm("Opravdu chcete tohoto uživatele smazat?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteUser(userForm.id);
      setSuccess("Uživatel byl smazán.");
      resetUserEditor();
      await loadGroupUsers();
      await loadGroups();
    } catch (e) {
      setError(e?.message || "Nepodařilo se smazat uživatele.");
    } finally {
      setSaving(false);
    }
  }

  async function importFile() {
    if (!selectedGroup?.id) {
      setError("Nejdřív vyber skupinu, do které chceš importovat.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setImporting(true);
      setError(null);
      setSuccess(null);

      try {
        let rows = [];

        if (file.name.toLowerCase().endsWith(".csv")) {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
          if (lines.length < 2) throw new Error("CSV neobsahuje data.");

          const delim = lines[0].includes(";") ? ";" : ",";
          const headers = lines[0].split(delim).map((h) => h.trim());

          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(delim);
            const obj = {};
            headers.forEach((h, idx) => (obj[h] = parts[idx] ?? ""));
            rows.push(obj);
          }
        } else {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        }

        const users = rows.map(toImportUser).filter((u) => u.email);

        if (!users.length) throw new Error("Nenalezen žádný validní e-mail v souboru.");

        const ok = window.confirm(
          `Importuješ ${users.length} uživatelů do skupiny "${selectedGroup.name}". Pokračovat?`
        );
        if (!ok) return;

        const r = await importUsersToGroup(Number(selectedGroup.id), users);
        setSuccess(`Import hotový: ${r?.imported ?? "?"} importováno, ${r?.skipped ?? 0} přeskočeno.`);
        await loadGroupUsers({ resetSkip: true });
        await loadGroups();
      } catch (e) {
        setError(e?.message || "Import se nezdařil.");
      } finally {
        setImporting(false);
      }
    };

    input.click();
  }

  const inCampaign = selectedGroup?.id && campaignGroupId && Number(selectedGroup.id) === Number(campaignGroupId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Příjemci (Skupiny)</h1>
            <p className="mt-1 text-xs text-gray-600 max-w-2xl">
              Vyber skupinu vlevo. Vpravo spravuješ uživatele skupiny (import / přidání / edit / smazání) a můžeš ji nastavit do aktuální kampaně.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateGroup}
            className="rounded-full border border-[var(--brand-strong)] px-3 py-1 text-xs font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
          >
            + Nová skupina
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          {/* LEFT: groups */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            {loadingGroups ? (
              <div className="text-xs text-gray-500">Načítám skupiny…</div>
            ) : (
              <div className="space-y-2">
                {sortedGroups.map((g) => {
                  const active = Number(g.id) === Number(selectedGroupId);
                  const cg = campaignGroupId && Number(g.id) === Number(campaignGroupId);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(Number(g.id));
                        setSkip(0);
                        setQ("");
                        resetUserEditor();
                        setGroupMode("view");
                      }}
                      className={[
                        "w-full rounded-xl px-3 py-2 text-left border transition",
                        active ? "bg-[var(--brand-soft)] border-[var(--brand-strong)]/20" : "bg-white/50 border-transparent hover:bg-white/80",
                        cg ? "ring-2 ring-[var(--brand-strong)]/40 shadow-[0_0_0_3px_rgba(46,36,211,0.10),0_12px_30px_rgba(15,23,42,0.10)]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-gray-900">{g.name}</div>
                          {cg && (
                            <div className="mt-1 inline-flex rounded-full bg-[var(--brand-strong)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)] ring-1 ring-[var(--brand-strong)]/25">
                              V aktuální kampani
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">{g.memberCount ?? ""}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: group detail + users */}
          <div className="space-y-4">
            {!selectedGroup ? (
              <div className="text-sm text-gray-500">Vyber skupinu vlevo.</div>
            ) : (
              <>
                {/* group header / actions */}
                <div className={["rounded-xl border p-3", inCampaign ? "border-[var(--brand-strong)]/25 shadow-[0_0_0_4px_rgba(46,36,211,0.08)]" : "border-gray-200"].join(" ")}>
                  {groupMode === "create" || groupMode === "edit" ? (
                    <form onSubmit={saveGroup} className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label className="mb-1 block text-[11px] font-medium text-gray-700">Název skupiny</label>
                        <input
                          ref={groupInputRef}
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                        />
                      </div>
                      <button type="submit" disabled={saving} className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                        {saving ? "Ukládám…" : "Uložit"}
                      </button>
                      <button type="button" onClick={cancelGroupEdit} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        Zrušit
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{selectedGroup.name}</div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {inCampaign ? "Skupina je nastavena v aktuální kampani." : "Skupina není v aktuální kampani."}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {hasCampaign && (
                          <button
                            type="button"
                            onClick={applyGroupToCampaign}
                            disabled={applyingCampaign}
                            className={[
                              "rounded-md px-3 py-1.5 text-xs font-semibold border",
                              inCampaign
                                ? "border-[var(--brand-strong)]/25 bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            {applyingCampaign ? "Nastavuji…" : inCampaign ? "V kampani" : "Nastavit do kampaně"}
                          </button>
                        )}

                        <button type="button" onClick={importFile} disabled={importing} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                          {importing ? "Import…" : "Import CSV/XLSX"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            resetUserEditor();
                            setSelectedUserId("new");
                          }}
                          className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          + Přidat uživatele
                        </button>

                        <button type="button" onClick={openEditGroup} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          Upravit skupinu
                        </button>

                        <button type="button" onClick={removeGroup} disabled={saving} className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
                          Smazat skupinu
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* search + paging */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Hledat v uživatelích (email/jméno)…"
                      className="w-[320px] max-w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                    />
                    <button
                      type="button"
                      onClick={() => loadGroupUsers({ resetSkip: true })}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Hledat
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span>
                      {Math.min(skip + 1, total)}–{Math.min(skip + take, total)} / {total}
                    </span>
                    <button
                      type="button"
                      disabled={skip === 0}
                      onClick={() => {
                        const next = Math.max(0, skip - take);
                        setSkip(next);
                        setTimeout(() => loadGroupUsers(), 0);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-50"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      disabled={skip + take >= total}
                      onClick={() => {
                        const next = skip + take;
                        setSkip(next);
                        setTimeout(() => loadGroupUsers(), 0);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 disabled:opacity-50"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {/* users table */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-[360px] overflow-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Jméno</th>
                          <th className="px-3 py-2">Příjmení</th>
                          <th className="px-3 py-2">Custom</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loadingUsers ? (
                          <tr><td className="px-3 py-3 text-gray-500" colSpan={4}>Načítám…</td></tr>
                        ) : groupUsers.length === 0 ? (
                          <tr><td className="px-3 py-3 text-gray-500" colSpan={4}>Žádní uživatelé.</td></tr>
                        ) : (
                          groupUsers.map((u) => {
                            const active = Number(u.id) === Number(selectedUserId);
                            const customCount = u.custom && typeof u.custom === "object" ? Object.keys(u.custom).length : 0;
                            return (
                              <tr
                                key={u.id}
                                onClick={() => selectUser(u)}
                                className={["cursor-pointer hover:bg-[var(--brand-soft)]", active ? "bg-[var(--brand-soft)]" : ""].join(" ")}
                              >
                                <td className="px-3 py-2">{u.email}</td>
                                <td className="px-3 py-2">{u.firstName || "–"}</td>
                                <td className="px-3 py-2">{u.lastName || "–"}</td>
                                <td className="px-3 py-2">{customCount ? `${customCount}×` : "–"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* user editor */}
                {(selectedUserId === "new" || !!userForm.id) && (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <form onSubmit={saveUser} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">
                          {userForm.id ? "Upravit uživatele" : "Přidat uživatele"}
                        </div>
                        <button type="button" onClick={resetUserEditor} className="text-[11px] text-gray-500 hover:underline">
                          Zavřít
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-700">Email</label>
                          <input
                            value={userForm.email}
                            onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-700">Jméno</label>
                          <input
                            value={userForm.firstName}
                            onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-700">Příjmení</label>
                          <input
                            value={userForm.lastName}
                            onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-700">Oddělení</label>
                          <input
                            value={userForm.department}
                            onChange={(e) => setUserForm((p) => ({ ...p, department: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-700">Role</label>
                          <input
                            value={userForm.role}
                            onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                          />
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowCustom((v) => !v)}
                          className="text-[11px] font-semibold text-[var(--brand-strong)] hover:underline"
                        >
                          {showCustom ? "Skrýt custom fields" : "Zobrazit custom fields (1–20)"}
                        </button>

                        {showCustom && (
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            {Array.from({ length: 20 }, (_, i) => {
                              const k = `custom${i + 1}`;
                              return (
                                <div key={k}>
                                  <label className="mb-1 block text-[10px] font-medium text-gray-600">{k}</label>
                                  <input
                                    value={userForm.custom?.[k] ?? ""}
                                    onChange={(e) =>
                                      setUserForm((p) => ({
                                        ...p,
                                        custom: { ...(p.custom || {}), [k]: e.target.value },
                                      }))
                                    }
                                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                          <button type="submit" disabled={saving} className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                            {saving ? "Ukládám…" : "Uložit"}
                          </button>
                          <button type="button" onClick={resetUserEditor} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                            Zrušit
                          </button>
                        </div>

                        {userForm.id && (
                          <button type="button" onClick={removeUser} disabled={saving} className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
                            Smazat
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}