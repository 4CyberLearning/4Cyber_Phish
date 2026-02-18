import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listSenderDomains,
  createSenderDomain,
  updateSenderDomain,
  deleteSenderDomain,
} from "../../api/senderDomains";
import {
  listSenderIdentities,
  createSenderIdentity,
  updateSenderIdentity,
  deleteSenderIdentity,
} from "../../api/senderIdentities";
import { updateCampaign } from "../../api/campaigns";
import { useCurrentCampaign } from "../../hooks/useCurrentCampaign";

const EMPTY_DOMAIN = {
  id: null,
  domain: "",
  description: "",
  isDefault: false,
};

const EMPTY_IDENTITY = {
  id: null,
  name: "",
  fromName: "",
  fromEmail: "",
  localPart: "",
  senderDomainId: "",
  replyTo: "",
  note: "",
  isDefault: false,
};

function parseEmail(raw) {
  const v = String(raw || "").trim();
  const m = v.match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return null;
  const localPart = String(m[1] || "").trim().toLowerCase();
  const domain = String(m[2] || "").trim().toLowerCase();
  if (!localPart || !domain || !domain.includes(".")) return null;
  return { localPart, domain };
}

function formatSender(identity) {
  if (!identity) return "";
  const local = identity.localPart;
  const domain = identity.senderDomain?.domain;
  const email = local && domain ? `${local}@${domain}` : null;

  if (identity.fromName && email) {
    return `${identity.fromName} <${email}>`;
  }
  return email || identity.fromName || "";
}

export default function SenderIdentitiesPage() {
  const { t } = useTranslation();

  const { hasCampaign, campaignId, campaign } = useCurrentCampaign();
  const campaignSenderIdentityId = campaign?.senderIdentityId ?? campaign?.senderIdentity?.id;
  const isInCurrentCampaign = (id) =>
    hasCampaign && Number(campaignSenderIdentityId) === Number(id);

  const [domains, setDomains] = useState([]);
  const [identities, setIdentities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [domainForm, setDomainForm] = useState(EMPTY_DOMAIN);
  const [identityForm, setIdentityForm] = useState(EMPTY_IDENTITY);

  const [domainSearch, setDomainSearch] = useState("");
  const [identitySearch, setIdentitySearch] = useState("");
  const [showAdvancedIdentity, setShowAdvancedIdentity] = useState(false);
  const [applyingCampaign, setApplyingCampaign] = useState(false);

  const identityPreview = useMemo(() => {
    const parsed = parseEmail(identityForm.fromEmail);

    const fallbackLocal = (identityForm.localPart || "").trim();
    const domId = identityForm.senderDomainId ? Number(identityForm.senderDomainId) : null;
    const dom = domains.find((d) => Number(d.id) === Number(domId));

    const email = parsed
      ? `${parsed.localPart}@${parsed.domain}`
      : fallbackLocal && dom?.domain
      ? `${fallbackLocal}@${dom.domain}`
      : "";

    const fromName = (identityForm.fromName || "").trim();

    if (fromName && email) return `${fromName} <${email}>`;
    return email || fromName || "—";
  }, [identityForm.fromEmail, identityForm.localPart, identityForm.senderDomainId, identityForm.fromName, domains]);

  async function applyIdentityToCampaign() {
    if (!hasCampaign) {
      setError("Nejdřív vyber kampaň v horním panelu.");
      return;
    }

    if (!identityForm.id) {
      setError("Nejdřív identitu ulož (Uložit identitu), pak ji lze přiřadit do kampaně.");
      return;
    }

    if (isInCurrentCampaign(identityForm.id)) {
      setSuccess("Tato identita už je v aktuální kampani.");
      return;
    }

    setApplyingCampaign(true);
    setError(null);
    setSuccess(null);

    try {
      await updateCampaign(Number(campaignId), { senderIdentityId: Number(identityForm.id) });
      window.dispatchEvent(new CustomEvent("campaign:updated", { detail: { id: String(campaignId) } }));
      setSuccess("Odesílací identita byla nastavena pro vybranou kampaň.");
    } catch (e) {
      setError(e?.message || "Nepodařilo se nastavit odesílací identitu do kampaně.");
    } finally {
      setApplyingCampaign(false);
    }
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [doms, ids] = await Promise.all([
          listSenderDomains(),
          listSenderIdentities(),
        ]);
        setDomains(Array.isArray(doms) ? doms : []);
        setIdentities(Array.isArray(ids) ? ids : []);
      } catch (e) {
        console.error(e);
        setError(
          e.message ||
            "Nepodařilo se načíst data o doménách a identitách."
        );
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => {
      const domain = (d.domain || "").toLowerCase();
      const desc = (d.description || "").toLowerCase();
      return domain.includes(q) || desc.includes(q);
    });
  }, [domains, domainSearch]);

  const filteredIdentities = useMemo(() => {
    const q = identitySearch.trim().toLowerCase();
    if (!q) return identities;
    return identities.filter((i) => {
      const name = (i.name || "").toLowerCase();
      const fromName = (i.fromName || "").toLowerCase();
      const localPart = (i.localPart || "").toLowerCase();
      const domain = (i.senderDomain?.domain || "").toLowerCase();
      return (
        name.includes(q) ||
        fromName.includes(q) ||
        localPart.includes(q) ||
        domain.includes(q)
      );
    });
  }, [identities, identitySearch]);

  function resetDomainForm() {
    setDomainForm(EMPTY_DOMAIN);
  }

  function resetIdentityForm() {
    setIdentityForm(EMPTY_IDENTITY);
  }

  function handleDomainField(field, value) {
    setDomainForm((prev) => ({
      ...prev,
      [field]: field === "isDefault" ? !!value : value,
    }));
    setSuccess(null);
    setError(null);
  }

  function handleIdentityField(field, value) {
    setIdentityForm((prev) => {
      if (field === "fromEmail") {
        const next = { ...prev, fromEmail: value };
        const parsed = parseEmail(value);
        if (parsed) {
          next.localPart = parsed.localPart;
          const match = domains.find((d) => String(d?.domain || "").toLowerCase() === parsed.domain);
          if (match?.id) next.senderDomainId = Number(match.id);
        }
        return next;
      }

      return {
        ...prev,
        [field]:
          field === "isDefault"
            ? !!value
            : field === "senderDomainId" && value
            ? Number(value)
            : value,
      };
    });

    setSuccess(null);
    setError(null);
  }

  async function handleSubmitDomain(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const domainValue = (domainForm.domain || "").trim();
    if (!domainValue) {
      setError("Zadejte doménu.");
      return;
    }

    try {
      let saved;
      if (domainForm.id) {
        saved = await updateSenderDomain(domainForm.id, {
          domain: domainValue,
          description: domainForm.description || "",
          isDefault: !!domainForm.isDefault,
        });
      } else {
        saved = await createSenderDomain({
          domain: domainValue,
          description: domainForm.description || "",
          isDefault: !!domainForm.isDefault,
        });
      }

      const doms = await listSenderDomains();
      setDomains(Array.isArray(doms) ? doms : []);
      setDomainForm({
        id: saved.id,
        domain: saved.domain || domainValue,
        description: saved.description || "",
        isDefault: !!saved.isDefault,
      });
      setSuccess("Doména byla uložena.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se uložit doménu.");
    }
  }

  async function handleDeleteDomain() {
    if (!domainForm.id) return;
    if (!window.confirm("Opravdu chcete tuto doménu smazat?")) return;

    setError(null);
    setSuccess(null);
    try {
      await deleteSenderDomain(domainForm.id);
      const doms = await listSenderDomains();
      setDomains(Array.isArray(doms) ? doms : []);
      resetDomainForm();
      setSuccess("Doména byla smazána.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se smazat doménu.");
    }
  }

  async function handleSubmitIdentity(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = (identityForm.name || "").trim();
    const fromEmail = (identityForm.fromEmail || "").trim();

    let localPart = (identityForm.localPart || "").trim();
    let senderDomainId = identityForm.senderDomainId ? Number(identityForm.senderDomainId) : null;

    if (fromEmail) {
      const parsed = parseEmail(fromEmail);
      if (!parsed) {
        setError("Zadejte platnou adresu ve tvaru uzivatel@domena.tld.");
        return;
      }

      localPart = parsed.localPart;

      let dom = domains.find((d) => String(d?.domain || "").toLowerCase() === parsed.domain);

      if (!dom) {
        try {
          await createSenderDomain({ domain: parsed.domain, description: "", isDefault: false });
        } catch {
          // ignore (např. už existuje)
        }

        const doms = await listSenderDomains();
        const arr = Array.isArray(doms) ? doms : [];
        setDomains(arr);
        dom = arr.find((d) => String(d?.domain || "").toLowerCase() === parsed.domain);
      }

      senderDomainId = dom?.id ? Number(dom.id) : null;
    }

    if (!localPart) {
      setError("Zadejte e-mail (nebo local-part).");
      return;
    }
    if (!senderDomainId) {
      setError("Vyberte doménu pro identitu (nebo vyplňte e-mail).");
      return;
    }

    const payload = {
      name,
      fromName: identityForm.fromName || "",
      localPart,
      senderDomainId,
      replyTo: identityForm.replyTo || "",
      note: identityForm.note || "",
      isDefault: !!identityForm.isDefault,
    };

    try {
      let saved;
      if (identityForm.id) {
        saved = await updateSenderIdentity(identityForm.id, payload);
      } else {
        saved = await createSenderIdentity(payload);
      }

      const ids = await listSenderIdentities();
      setIdentities(Array.isArray(ids) ? ids : []);

      setIdentityForm({
        id: saved.id,
        name: saved.name || name,
        fromName: saved.fromName || "",
        fromEmail:
          saved.localPart && saved.senderDomain?.domain
            ? `${saved.localPart}@${saved.senderDomain.domain}`
            : fromEmail || "",
        localPart: saved.localPart || localPart,
        senderDomainId: saved.senderDomainId || senderDomainId,
        replyTo: saved.replyTo || "",
        note: saved.note || "",
        isDefault: !!saved.isDefault,
      });
      setSuccess("Odesílací identita byla uložena.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se uložit identitu.");
    }
  }

  async function handleDeleteIdentity() {
    if (!identityForm.id) return;
    if (!window.confirm("Opravdu chcete tuto identitu smazat?")) return;

    setError(null);
    setSuccess(null);
    try {
      await deleteSenderIdentity(identityForm.id);
      const ids = await listSenderIdentities();
      setIdentities(Array.isArray(ids) ? ids : []);
      resetIdentityForm();
      setSuccess("Odesílací identita byla smazána.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Nepodařilo se smazat identitu.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("content.senderIdentities.title") ||
            "Odesílací identity a domény"}
        </h1>
        <p className="mt-1 text-xs text-gray-600 max-w-2xl">
          Nejprve přidej odesílací domény (např. phish.firma.cz), následně
          pro ně definuj identity s konkrétním local-partem (před
          zavináčem).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* DOMÉNY */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Odesílací domény
            </h2>
            <p className="mt-1 text-xs text-gray-500 max-w-xl">
              Doména určuje část za zavináčem (např. phish.firma.cz). Můžeš
              mít více domén pro různé zákazníky nebo scénáře.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <input
              type="text"
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
              placeholder="Filtrovat podle domény nebo popisu…"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr),minmax(0,1.4fr)]">
          {/* formulář domény */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <form className="space-y-3" onSubmit={handleSubmitDomain}>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-700">
                  Doména
                </label>
                <input
                  type="text"
                  value={domainForm.domain}
                  onChange={(e) =>
                    handleDomainField("domain", e.target.value)
                  }
                  placeholder="např. phish.firma.cz"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-700">
                  Popisek (volitelný)
                </label>
                <input
                  type="text"
                  value={domainForm.description}
                  onChange={(e) =>
                    handleDomainField("description", e.target.value)
                  }
                  placeholder="např. doména pro HR kampaně"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  checked={!!domainForm.isDefault}
                  onChange={(e) => handleDomainField("isDefault", e.target.checked)}
                />
                Nastavit jako výchozí doménu
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                >
                  {domainForm.id ? "Uložit doménu" : "Přidat doménu"}
                </button>

                {domainForm.id && (
                  <>
                    <button
                      type="button"
                      onClick={resetDomainForm}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      Zrušit úpravy
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteDomain}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Smazat
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>

          {/* seznam domén */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium text-gray-800">Seznam domén</div>
              <div className="text-[11px] text-gray-500">
                {filteredDomains.length} / {domains.length}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredDomains.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-gray-400">
                  Zatím nemáte žádné domény.
                </div>
              ) : (
                filteredDomains.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setDomainForm({
                        id: d.id,
                        domain: d.domain || "",
                        description: d.description || "",
                        isDefault: !!d.isDefault,
                      })
                    }
                    className={
                      "flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-gray-50 " +
                      (domainForm.id === d.id
                        ? "bg-[var(--brand-soft)]"
                        : "")
                    }
                  >
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {d.domain}
                      </div>
                      {d.description && (
                        <div className="text-[11px] text-gray-500">
                          {d.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-gray-500">
                      {d.isDefault ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Výchozí
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          –
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IDENTITY */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Odesílací identity
            </h2>
            <p className="mt-1 text-xs text-gray-500 max-w-xl">
              Identity kombinují jméno odesílatele, local-part a doménu do
              finální adresy, ze které budou chodit e-maily kampaní.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <input
              type="text"
              value={identitySearch}
              onChange={(e) => setIdentitySearch(e.target.value)}
              placeholder="Filtrovat podle názvu, adresy nebo domény…"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr),minmax(0,1.6fr)]">
          {/* formulář identity */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <form className="space-y-3" onSubmit={handleSubmitIdentity}>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-700">
                    Název identity
                  </label>
                  <input
                    type="text"
                    value={identityForm.name}
                    onChange={(e) =>
                      handleIdentityField("name", e.target.value)
                    }
                    placeholder="Např. HR newsletter"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-700">
                    Jméno odesílatele
                  </label>
                  <input
                    type="text"
                    value={identityForm.fromName}
                    onChange={(e) =>
                      handleIdentityField("fromName", e.target.value)
                    }
                    placeholder="Např. HR oddělení"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-700">
                  From e-mail (doporučeno)
                </label>
                <input
                  type="text"
                  value={identityForm.fromEmail}
                  onChange={(e) => handleIdentityField("fromEmail", e.target.value)}
                  placeholder="např. hr@phish.firma.cz"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-gray-500">
                    Doména se při uložení případně vytvoří automaticky.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedIdentity((v) => !v)}
                    className="text-[11px] font-semibold text-[var(--brand-strong)] hover:underline"
                  >
                    {showAdvancedIdentity ? "Skrýt rozšířené" : "Zobrazit rozšířené"}
                  </button>
                </div>
              </div>

              {showAdvancedIdentity && (
                <div className="grid gap-3 md:grid-cols-[1.2fr,1.2fr]">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-700">
                      Local-part (před @)
                    </label>
                    <input
                      type="text"
                      value={identityForm.localPart}
                      onChange={(e) => handleIdentityField("localPart", e.target.value)}
                      placeholder="např. hr"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-700">
                      Doména
                    </label>
                    <select
                      value={identityForm.senderDomainId || ""}
                      onChange={(e) => handleIdentityField("senderDomainId", e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
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
                </div>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-semibold text-gray-700">Výsledná identita</div>
                <div className="mt-1 font-mono text-[12px] text-gray-900 break-all">{identityPreview}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-700">
                    Reply-To (volitelné)
                  </label>
                  <input
                    type="email"
                    value={identityForm.replyTo}
                    onChange={(e) =>
                      handleIdentityField("replyTo", e.target.value)
                    }
                    placeholder="kam mají přijít odpovědi"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-700">
                    Popis / poznámka
                  </label>
                  <input
                    type="text"
                    value={identityForm.note}
                    onChange={(e) =>
                      handleIdentityField("note", e.target.value)
                    }
                    placeholder="Interní poznámka"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  checked={!!identityForm.isDefault}
                  onChange={(e) =>
                    handleIdentityField("isDefault", e.target.checked)
                  }
                />
                Nastavit jako výchozí identitu pro tenant
              </label>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                  >
                    {identityForm.id ? "Uložit identitu" : "Přidat identitu"}
                  </button>

                  {hasCampaign && (
                    <button
                      type="button"
                      onClick={applyIdentityToCampaign}
                      disabled={!identityForm.id || applyingCampaign || isInCurrentCampaign(identityForm.id)}
                      title={
                        !identityForm.id
                          ? "Nejdřív identitu ulož"
                          : isInCurrentCampaign(identityForm.id)
                          ? "Tato identita už je v aktuální kampani"
                          : "Nastavit tuto identitu do vybrané kampaně"
                      }
                      className={`rounded-md border px-3 py-1.5 text-[11px] font-medium disabled:opacity-50 ${
                        isInCurrentCampaign(identityForm.id)
                          ? "border-[var(--brand-strong)]/25 bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "border-slate-200/70 bg-white/20 text-slate-700 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {isInCurrentCampaign(identityForm.id) ? "V kampani" : "Do kampaně"}
                    </button>
                  )}

                  {identityForm.id && (
                    <button
                      type="button"
                      onClick={resetIdentityForm}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      Zrušit úpravy
                    </button>
                  )}
                </div>

                {identityForm.id && (
                  <button
                    type="button"
                    onClick={handleDeleteIdentity}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50"
                  >
                    Smazat
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* seznam identit */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium text-gray-800">
                Seznam odesílacích identit
              </div>
              <div className="text-[11px] text-gray-500">
                {filteredIdentities.length} / {identities.length}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {filteredIdentities.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-gray-400">
                  Zatím nemáte žádné identity. Nejprve vytvoř doménu a poté
                  identitu.
                </div>
              ) : (
                filteredIdentities.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() =>
                      setIdentityForm({
                        id: i.id,
                        name: i.name || "",
                        fromName: i.fromName || "",
                        fromEmail:
                          i.localPart && i.senderDomain?.domain
                            ? `${i.localPart}@${i.senderDomain.domain}`
                            : "",
                        localPart: i.localPart || "",
                        senderDomainId: i.senderDomainId || i.senderDomain?.id || "",
                        replyTo: i.replyTo || "",
                        note: i.note || "",
                        isDefault: !!i.isDefault,
                      })
                    }
                    className={`relative flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-gray-50 ${
                      identityForm.id === i.id ? "bg-[var(--brand-soft)]" : ""
                    } ${
                      isInCurrentCampaign(i.id)
                        ? "bg-[var(--brand-soft)]/30 ring-2 ring-[var(--brand-strong)]/25 shadow-[0_0_0_1px_rgba(46,36,211,0.28),0_0_28px_rgba(71,101,238,0.34)]"
                        : ""
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {i.name || "(bez názvu)"}
                      </div>
                      <div className="text-[11px] text-gray-600">
                        {formatSender(i) || "—"}
                      </div>
                      {i.note && (
                        <div className="text-[11px] text-gray-500">
                          {i.note}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-gray-500 space-y-1">
                      {isInCurrentCampaign(i.id) && (
                        <div>
                          <span className="rounded-full bg-[var(--brand-strong)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)] ring-1 ring-[var(--brand-strong)]/25">
                            V aktuální kampani
                          </span>
                        </div>
                      )}

                      {i.isDefault ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Výchozí
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">–</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
