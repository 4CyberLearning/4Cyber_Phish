import { useEffect, useState } from "react";
import {
  listSenderIdentities,
  createSenderIdentity,
  updateSenderIdentity,
  deleteSenderIdentity,
} from "../../api/senderIdentities";
import {
  listSenderDomains,
  createSenderDomain,
  updateSenderDomain,
  deleteSenderDomain,
} from "../../api/senderDomains";

const EMPTY_IDENTITY = {
  id: null,
  name: "",
  fromName: "",
  localPart: "",
  senderDomainId: "",
  replyTo: "",
  description: "",
  isDefault: false,
};

const EMPTY_DOMAIN = {
  id: null,
  domain: "",
  label: "",
  isDefault: false,
};

export default function SenderIdentitiesPage() {
  const [identities, setIdentities] = useState([]);
  const [domains, setDomains] = useState([]);

  const [identityForm, setIdentityForm] = useState(EMPTY_IDENTITY);
  const [domainForm, setDomainForm] = useState(EMPTY_DOMAIN);

  const [editingIdentityId, setEditingIdentityId] = useState(null);
  const [editingDomainId, setEditingDomainId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [error, setError] = useState(null);

  function setIdentityField(field, value) {
    setIdentityForm((prev) => ({ ...prev, [field]: value }));
  }

  function setDomainField(field, value) {
    setDomainForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [ids, doms] = await Promise.all([
        listSenderIdentities(),
        listSenderDomains(),
      ]);
      setIdentities(Array.isArray(ids) ? ids : []);
      setDomains(Array.isArray(doms) ? doms : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se načíst data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetIdentityForm() {
    setEditingIdentityId(null);
    setIdentityForm(EMPTY_IDENTITY);
  }

  function resetDomainForm() {
    setEditingDomainId(null);
    setDomainForm(EMPTY_DOMAIN);
  }

  function handleEditIdentity(item) {
    setEditingIdentityId(item.id);
    setIdentityForm({
      id: item.id,
      name: item.name || "",
      fromName: item.fromName || "",
      localPart: item.localPart || "",
      senderDomainId: item.senderDomainId || "",
      replyTo: item.replyTo || "",
      description: item.description || "",
      isDefault: !!item.isDefault,
    });
    setError(null);
  }

  function handleEditDomain(item) {
    setEditingDomainId(item.id);
    setDomainForm({
      id: item.id,
      domain: item.domain || "",
      label: item.label || "",
      isDefault: !!item.isDefault,
    });
    setError(null);
  }

  function formatEmailPreview(form) {
    const local = (form.localPart || "").trim();
    const domainId = Number(form.senderDomainId);
    const domain = domains.find((d) => d.id === domainId);
    if (!local || !domain) return "";
    return `${local}@${domain.domain}`;
  }

  // ------- DOMAINS -------

  async function handleSubmitDomain(e) {
    e.preventDefault();
    setError(null);

    const payload = {
      domain: (domainForm.domain || "").trim(),
      label: (domainForm.label || "").trim(),
      isDefault: !!domainForm.isDefault,
    };

    if (!payload.domain) {
      setError("Doména je povinná.");
      return;
    }

    setSavingDomain(true);
    try {
      if (editingDomainId) {
        await updateSenderDomain(editingDomainId, payload);
      } else {
        await createSenderDomain(payload);
      }
      await loadAll();
      resetDomainForm();
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se uložit doménu");
    } finally {
      setSavingDomain(false);
    }
  }

  async function handleDeleteDomain(id) {
    if (!window.confirm("Opravdu smazat tuto doménu?")) return;
    setError(null);
    try {
      await deleteSenderDomain(id);
      await loadAll();
      if (editingDomainId === id) {
        resetDomainForm();
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se smazat doménu");
    }
  }

  // ------- IDENTITIES -------

  async function handleSubmitIdentity(e) {
    e.preventDefault();
    setError(null);

    const payload = {
      name: (identityForm.name || "").trim(),
      fromName: (identityForm.fromName || "").trim(),
      localPart: (identityForm.localPart || "").trim(),
      senderDomainId: identityForm.senderDomainId
        ? Number(identityForm.senderDomainId)
        : null,
      replyTo: identityForm.replyTo ? identityForm.replyTo.trim() : "",
      description: identityForm.description
        ? identityForm.description.trim()
        : "",
      isDefault: !!identityForm.isDefault,
    };

    if (!payload.name || !payload.fromName || !payload.localPart) {
      setError("Název, jméno odesílatele a local-part jsou povinné.");
      return;
    }
    if (!payload.senderDomainId) {
      setError("Vyber odesílací doménu.");
      return;
    }

    setSavingIdentity(true);
    try {
      if (editingIdentityId) {
        await updateSenderIdentity(editingIdentityId, payload);
      } else {
        await createSenderIdentity(payload);
      }
      await loadAll();
      resetIdentityForm();
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se uložit identitu");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleDeleteIdentity(id) {
    if (!window.confirm("Opravdu smazat tuto identitu?")) return;
    setError(null);
    try {
      await deleteSenderIdentity(id);
      await loadAll();
      if (editingIdentityId === id) {
        resetIdentityForm();
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se smazat identitu");
    }
  }

  function formatIdentityRow(item) {
    const local = item.localPart;
    const domain = item.senderDomain?.domain;
    const email = local && domain ? `${local}@${domain}` : null;
    if (item.fromName && email) {
      return `${item.fromName} <${email}>`;
    }
    return email || item.fromName || "";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">
          Odesílací identity a domény
        </h1>
        <p className="text-gray-600 text-sm max-w-2xl">
          Nejprve přidej odesílací domény (např. phish.firma.cz), následně pro
          ně definuj identity s konkrétním local-partem (před zavináčem).
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Domény */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Odesílací domény
          </h2>
          <form className="space-y-4" onSubmit={handleSubmitDomain}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Doména
                </label>
                <input
                  type="text"
                  value={domainForm.domain}
                  onChange={(e) => setDomainField("domain", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="např. phish.firma.cz"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Popisek (volitelný)
                </label>
                <input
                  type="text"
                  value={domainForm.label}
                  onChange={(e) => setDomainField("label", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="např. doména pro HR kampaně"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={!!domainForm.isDefault}
                  onChange={(e) =>
                    setDomainField("isDefault", e.target.checked)
                  }
                />
                Nastavit jako výchozí doménu
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetDomainForm}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Nová doména
                </button>
                <button
                  type="submit"
                  disabled={savingDomain}
                  className="rounded-md bg-[var(--brand-strong)] px-4 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {editingDomainId ? "Uložit doménu" : "Přidat doménu"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Seznam domén
            </h3>
            {loading && (
              <span className="text-xs text-gray-500">Načítání…</span>
            )}
          </div>
          {domains.length === 0 ? (
            <div className="text-sm text-gray-500">
              Zatím žádné domény. Přidej první vlevo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left font-medium text-gray-700">
                      Doména
                    </th>
                    <th className="p-2 text-left font-medium text-gray-700">
                      Popis
                    </th>
                    <th className="p-2 text-left font-medium text-gray-700">
                      Výchozí
                    </th>
                    <th className="p-2 text-right font-medium text-gray-700">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.id} className="border-b last:border-b-0">
                      <td className="p-2 align-top font-medium text-gray-900">
                        {d.domain}
                      </td>
                      <td className="p-2 align-top text-[11px] text-gray-600">
                        {d.label || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="p-2 align-top">
                        {d.isDefault ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            výchozí
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 align-top text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditDomain(d)}
                          className="text-[11px] text-[var(--brand-strong)] hover:underline"
                        >
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDomain(d.id)}
                          className="text-[11px] text-red-600 hover:underline"
                        >
                          Smazat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Odesílací identity
          </h2>
          <form className="space-y-4" onSubmit={handleSubmitIdentity}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Název identity
                </label>
                <input
                  type="text"
                  value={identityForm.name}
                  onChange={(e) => setIdentityField("name", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="Např. HR newsletter"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Jméno odesílatele
                </label>
                <input
                  type="text"
                  value={identityForm.fromName}
                  onChange={(e) =>
                    setIdentityField("fromName", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="Např. HR oddělení"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Local-part (před @)
                </label>
                <input
                  type="text"
                  value={identityForm.localPart}
                  onChange={(e) =>
                    setIdentityField("localPart", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="např. hr"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Doména
                </label>
                <select
                  value={identityForm.senderDomainId}
                  onChange={(e) =>
                    setIdentityField("senderDomainId", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                >
                  <option value="">– vyber doménu –</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.domain}
                      {d.isDefault ? " (výchozí)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-gray-500">
                  Výsledný e-mail:
                </span>
                <span className="text-xs font-medium text-gray-900">
                  {formatEmailPreview(identityForm) || "-"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Reply-To (volitelné)
                </label>
                <input
                  type="email"
                  value={identityForm.replyTo}
                  onChange={(e) =>
                    setIdentityField("replyTo", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="kam mají přijít odpovědi"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Popis / poznámka
                </label>
                <input
                  type="text"
                  value={identityForm.description}
                  onChange={(e) =>
                    setIdentityField("description", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder="Interní poznámka"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={!!identityForm.isDefault}
                  onChange={(e) =>
                    setIdentityField("isDefault", e.target.checked)
                  }
                />
                Nastavit jako výchozí identitu pro tenant
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetIdentityForm}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Nová identita
                </button>
                <button
                  type="submit"
                  disabled={savingIdentity}
                  className="rounded-md bg-[var(--brand-strong)] px-4 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {editingIdentityId ? "Uložit změny" : "Přidat identitu"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Seznam odesílacích identit
            </h3>
            {loading && (
              <span className="text-xs text-gray-500">Načítání…</span>
            )}
          </div>
          {identities.length === 0 ? (
            <div className="text-sm text-gray-500">
              Zatím žádné identity. Přidej první vlevo.
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
                      Výchozí
                    </th>
                    <th className="p-2 text-right font-medium text-gray-700">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {identities.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="p-2 align-top">
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="mt-0.5 text-[11px] text-gray-500">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        {formatIdentityRow(item)}
                      </td>
                      <td className="p-2 align-top">
                        {item.isDefault ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            výchozí
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 align-top text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditIdentity(item)}
                          className="text-[11px] text-[var(--brand-strong)] hover:underline"
                        >
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIdentity(item.id)}
                          className="text-[11px] text-red-600 hover:underline"
                        >
                          Smazat
                        </button>
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
