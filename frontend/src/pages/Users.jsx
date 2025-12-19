// frontend/src/pages/Users.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listGroups,
  createGroup,
  deleteGroup,
} from "../api/users";

const EMPTY_USER = {
  id: null,
  email: "",
  fullName: "",
  department: "",
  role: "",
  groupIds: [],
};

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState("all"); // "all" | "ungrouped" | groupId
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [u, g] = await Promise.all([listUsers(), listGroups()]);
      setUsers(Array.isArray(u) ? u : []);
      setGroups(Array.isArray(g) ? g : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedUserId(null);
    setForm(EMPTY_USER);
    setError(null);
    setSuccess(null);
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleGroupInForm(groupId) {
    setForm((prev) => {
      const set = new Set(prev.groupIds || []);
      if (set.has(groupId)) {
        set.delete(groupId);
      } else {
        set.add(groupId);
      }
      return {
        ...prev,
        groupIds: Array.from(set),
      };
    });
  }

  const filteredUsers = useMemo(() => {
    if (selectedGroupKey === "all") return users;

    if (selectedGroupKey === "ungrouped") {
      return users.filter((u) => !u.groups || u.groups.length === 0);
    }

    const groupId =
      typeof selectedGroupKey === "number"
        ? selectedGroupKey
        : Number(selectedGroupKey);

    if (!groupId) return users;

    return users.filter((u) =>
      u.groups?.some((g) => g.id === groupId)
    );
  }, [users, selectedGroupKey]);

  function handleSelectUser(u) {
    setSelectedUserId(u.id);
    setForm({
      id: u.id,
      email: u.email || "",
      fullName: u.fullName || "",
      department: u.department || "",
      role: u.role || "",
      groupIds:
        u.groups?.map((g) => g.id).filter((id) => !!id) || [],
    });
    setError(null);
    setSuccess(null);
  }

  async function handleSaveUser(e) {
    if (e) e.preventDefault();

    const email = (form.email || "").trim().toLowerCase();
    if (!email) {
      setError(
        t("content.recipients.messages.emailRequired") ||
          "E-mail je povinný."
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        email,
        fullName: (form.fullName || "").trim(),
        department: (form.department || "").trim(),
        role: (form.role || "").trim(),
        groupIds: form.groupIds || [],
      };

      let saved;
      if (form.id) {
        saved = await updateUser(form.id, payload);
      } else {
        saved = await createUser(payload);
      }

      await loadData();

      if (saved && saved.id) {
        setSelectedUserId(saved.id);
        setForm({
          id: saved.id,
          email: saved.email || "",
          fullName: saved.fullName || "",
          department: saved.department || "",
          role: saved.role || "",
          groupIds:
            saved.groups?.map((g) => g.id).filter((id) => !!id) || [],
        });
      } else {
        resetForm();
      }

      setSuccess(
        t("content.recipients.messages.saved") || "Příjemce uložen."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!form.id) return;
    if (
      !window.confirm(
        t("content.recipients.messages.confirmDeleteUser") ||
          "Opravdu chcete tohoto příjemce smazat?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteUser(form.id);
      await loadData();
      resetForm();
      setSuccess(
        t("content.recipients.messages.deleted") || "Příjemce byl smazán."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup() {
    const name = window.prompt(
      t("content.recipients.messages.newGroupPrompt") ||
        "Zadejte název nové skupiny:"
    );
    if (!name) return;

    setError(null);
    setSuccess(null);
    try {
      const group = await createGroup({ name });
      setGroups((prev) => [...prev, group]);
      setSuccess(
        t("content.recipients.messages.groupCreated") ||
          "Skupina vytvořena."
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteGroup(groupId) {
    if (
      !window.confirm(
        t("content.recipients.messages.confirmDeleteGroup") ||
          "Opravdu chcete tuto skupinu smazat? Členství uživatelů bude odstraněno."
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSelectedGroupKey("all");
      await loadData();
      setSuccess(
        t("content.recipients.messages.groupDeleted") ||
          "Skupina byla smazána."
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleImportCsv() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      setImporting(true);
      setError(null);
      setSuccess(null);

      try {
        const text = await file.text();
        // jednoduchý CSV parser: očekává hlavičku email;fullName;department;role nebo CSV s čárkami
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (!lines.length) {
          throw new Error("Soubor neobsahuje žádná data.");
        }

        const header = lines[0]
          .split(/[;,]/)
          .map((h) => h.trim().toLowerCase());
        const idxEmail = header.indexOf("email");
        const idxName = header.indexOf("fullname");
        const idxDept = header.indexOf("department");
        const idxRole = header.indexOf("role");

        if (idxEmail === -1) {
          throw new Error(
            "CSV musí obsahovat sloupec 'email' (např. email;fullName;department;role)."
          );
        }

        let imported = 0;
        let failed = 0;

        // jednoduchý sekvenční import
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/[;,]/).map((v) => v.trim());
          const email = parts[idxEmail] || "";
          if (!email) {
            failed++;
            continue;
          }

          const payload = {
            email,
            fullName: idxName !== -1 ? parts[idxName] || "" : "",
            department: idxDept !== -1 ? parts[idxDept] || "" : "",
            role: idxRole !== -1 ? parts[idxRole] || "" : "",
            groupIds: [],
          };

          try {
            await createUser(payload);
            imported++;
          } catch {
            failed++;
          }
        }

        await loadData();

        setSuccess(
          `Import dokončen: ${imported} řádků úspěšně, ${failed} neúspěšně.`
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setImporting(false);
      }
    };

    input.click();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* hlavička */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-gray-900">
              {t("content.recipients.title") || "Příjemci kampaní"}
            </h1>
            <p className="text-xs text-gray-500">
              Správa uživatelů a skupin, které budou cílem phishingových
              kampaní.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleImportCsv}
              disabled={importing}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {t("content.recipients.actions.importCsv") || "Import CSV"}
            </button>
            <button
              type="button"
              onClick={handleCreateGroup}
              className="rounded-full border border-[var(--brand-strong)] px-3 py-1 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
            >
              {t("content.recipients.actions.newGroup") || "Nová skupina"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full bg-[var(--brand-strong)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-soft-dark)]"
            >
              {t("content.recipients.actions.newUser") || "Nový příjemce"}
            </button>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className="rounded-2xl bg-white p-4 shadow-sm text-sm">
          {error && (
            <div className="mb-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {success}
            </div>
          )}
        </div>
      )}

      {/* hlavní layout: vlevo skupiny, vpravo tabulka + formulář */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-gray-500">
            {t("common.loading") || "Načítání..."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px,1fr]">
            {/* panel skupin */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase text-gray-500">
                {t("content.recipients.groups.title") || "Skupiny"}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedGroupKey("all")}
                  className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                    selectedGroupKey === "all"
                      ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  <span>
                    {t("content.recipients.groups.all") || "Všichni příjemci"}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {users.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedGroupKey("ungrouped")}
                  className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                    selectedGroupKey === "ungrouped"
                      ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  <span>
                    {t("content.recipients.groups.ungrouped") ||
                      "Bez skupiny"}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {
                      users.filter(
                        (u) => !u.groupLinks || u.groupLinks.length === 0
                      ).length
                    }
                  </span>
                </button>

                <div className="mt-2 border-t border-gray-200 pt-2">
                  {groups.length === 0 ? (
                    <div className="text-[11px] text-gray-500">
                      {t("content.recipients.groups.empty") ||
                        "Zatím nemáte žádné skupiny."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {groups.map((g) => (
                        <div
                          key={g.id}
                          className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${
                            selectedGroupKey === g.id
                              ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                              : "text-gray-700 hover:bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => setSelectedGroupKey(g.id)}
                          >
                            {g.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500">
                              {g.memberCount ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g.id)}
                              className="text-[10px] text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* pravý panel: tabulka + formulář */}
            <div className="flex flex-col gap-4">
              {/* tabulka uživatelů */}
              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">
                  {t("content.recipients.users.title") ||
                    "Příjemci (uživatelé)"}
                </div>
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-500">
                    {t("content.recipients.users.empty") ||
                      "Zatím nemáte žádné příjemce."}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-auto text-xs">
                    <table className="min-w-full text-left">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2">E-mail</th>
                          <th className="px-3 py-2">Jméno</th>
                          <th className="px-3 py-2">Oddělení</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Skupiny</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredUsers.map((u) => (
                          <tr
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`cursor-pointer hover:bg-[var(--brand-soft)] ${
                              u.id === selectedUserId
                                ? "bg-[var(--brand-soft)]"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-1.5">{u.email}</td>
                            <td className="px-3 py-1.5">
                              {u.fullName || <span className="text-gray-400">–</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              {u.department || (
                                <span className="text-gray-400">–</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {u.role || <span className="text-gray-400">–</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              {u.groups && u.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {u.groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                                    >
                                      {g.name || g.id}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">–</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* formulář pro jednoho uživatele */}
              <div className="rounded-lg border border-gray-200 p-3 text-xs">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={handleSaveUser}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-700">
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-700">
                        Jméno
                      </label>
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={(e) => setField("fullName", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-700">
                        Oddělení
                      </label>
                      <input
                        type="text"
                        value={form.department}
                        onChange={(e) =>
                          setField("department", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-700">
                        Role / pozice
                      </label>
                      <input
                        type="text"
                        value={form.role}
                        onChange={(e) => setField("role", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-700">
                      Skupiny
                    </label>
                    {groups.length === 0 ? (
                      <div className="text-[11px] text-gray-500">
                        {t("content.recipients.groups.empty") ||
                          "Zatím nemáte žádné skupiny."}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {groups.map((g) => (
                          <label
                            key={g.id}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={form.groupIds?.includes(g.id) || false}
                              onChange={() => toggleGroupInForm(g.id)}
                            />
                            <span>{g.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap justify-between gap-2">
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {t("content.recipients.actions.save") || "Uložit"}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {t("common.cancel") || "Nový / zrušit"}
                      </button>
                    </div>

                    {form.id && (
                      <button
                        type="button"
                        onClick={handleDeleteUser}
                        disabled={saving}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {t("common.delete") || "Smazat"}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
