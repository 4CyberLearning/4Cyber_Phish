// frontend/src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listRecipientDomains,
  createRecipientDomain,
  deleteRecipientDomain,
} from "../api/recipientDomains";

function normalizeDomainInput(v) {
  let s = String(v || "").trim().toLowerCase();
  s = s
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:.+$/, "");
  return s;
}

export default function Settings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
    return arr;
  }, [items]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const list = await listRecipientDomains();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onAdd(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const d = normalizeDomainInput(domain);
      await createRecipientDomain({
        domain: d,
        description: description || null,
      });
      setDomain("");
      setDescription("");
      await reload();
    } catch (e2) {
      setError(e2?.message || "Failed to add domain");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Opravdu smazat doménu z allowlistu?")) return;
    setError(null);
    try {
      await deleteRecipientDomain(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e?.message || "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
        <div className="font-medium">Allowlist domén příjemců</div>
        <div className="mt-1">
          Jakmile zde bude alespoň 1 doména, backend začne blokovat:
          <ul className="list-disc ml-5 mt-1">
            <li>vytváření/upravy uživatelů mimo allowlist domén</li>
            <li>odesílání e-mailů mimo allowlist domén</li>
          </ul>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form onSubmit={onAdd} className="bg-white border rounded p-4 space-y-3">
        <div className="font-medium text-gray-900">Přidat doménu</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">Doména</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="firma.cz"
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Popis (volitelné)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="např. interní doména"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Přidat"}
        </button>
      </form>

      <div className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium text-gray-900">Povolené domény</div>
          <button
            onClick={reload}
            className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600 mt-3">Načítám…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-gray-600 mt-3">Zatím žádné domény.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Doména</th>
                  <th className="py-2 pr-4">Popis</th>
                  <th className="py-2">Akce</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((x) => (
                  <tr key={x.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono">{x.domain}</td>
                    <td className="py-2 pr-4">{x.description || ""}</td>
                    <td className="py-2">
                      <button
                        onClick={() => onDelete(x.id)}
                        className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
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
  );
}