import { useState } from "react";
import { createCampaign } from "../api/campaigns";
import { useNavigate } from "react-router-dom";

const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
const LOCK_KEY = "campaign.locked.v1";
const CAMPAIGN_SELECTED_EVENT = "campaign:selected";
const CAMPAIGN_CHANGED_EVENT = "campaign:changed";

export default function CampaignCreate() {
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    const name = (form.name || "").trim();
    if (!name) {
      setError("Název kampaně je povinný.");
      return;
    }

    setCreating(true);
    try {
      const created = await createCampaign({
        name,
        description: (form.description || "").trim(),
      });
      const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
      const LOCK_KEY = "campaign.locked.v1";
      const CAMPAIGN_SELECTED_EVENT = "campaign:selected";
      const CAMPAIGN_CHANGED_EVENT = "campaign:changed";
      const CAMPAIGN_UPDATED_EVENT = "campaign:updated";

      // odemkni a nastav novou kampaň jako aktuální
      localStorage.setItem(LOCK_KEY, "0");
      localStorage.setItem(SELECTED_CAMPAIGN_KEY, String(created.id));

      const detail = { id: String(created.id), force: true, refreshList: true };
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CHANGED_EVENT, { detail }));
      window.dispatchEvent(new CustomEvent(CAMPAIGN_SELECTED_EVENT, { detail }));
      window.dispatchEvent(new CustomEvent(CAMPAIGN_UPDATED_EVENT, { detail: { refreshList: true } }));
      
      // aby šlo automaticky přepnout kampaň v Topbaru (i když byl lock)
      localStorage.setItem(LOCK_KEY, "0");
      localStorage.setItem(SELECTED_CAMPAIGN_KEY, String(created.id));

      const payload = { detail: { id: String(created.id) } };
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CHANGED_EVENT, payload));
      window.dispatchEvent(new CustomEvent(CAMPAIGN_SELECTED_EVENT, payload));

      // pokračovat na krok "Email"
      navigate("/content/email-templates");
    } catch (e2) {
      setError(e2?.message || "Nepodařilo se vytvořit kampaň.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Nová kampaň</h1>
        <p className="mt-1 text-xs text-gray-600 max-w-2xl">
          Zadej název a krátkou interní poznámku. Po vytvoření se kampaň automaticky vybere v horním panelu.
          Doporučuji ji uzamknout (ikonou zámku) a postupovat krok za krokem podle horní lišty.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-white p-4 shadow-sm text-sm">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form className="space-y-4" onSubmit={handleCreate}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Název kampaně</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
              placeholder="Např. CFO spear-phishing"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Popis / poznámka</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
              placeholder="Interní poznámka pro orientaci/report…"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-[var(--brand-strong)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {creating ? "Vytvářím…" : "Vytvořit kampaň a pokračovat"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/campaigns")}
              className="text-[11px] text-gray-500 hover:underline"
            >
              Zpět na přehled kampaní
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}