import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { listTemplates } from "../../api/templates";
import { listLandingPages } from "../../api/landingPages";
import { listSenderIdentities } from "../../api/senderIdentities.jsx";
import { listPackages, createPackage, updatePackage, deletePackage } from "../../api/packages";

const EMPTY_FORM = {
  id: null,
  name: "",
  description: "",
  category: "",
  difficulty: 1,
  previewText: "",
  isActive: true,
  isApproved: false,
  emailTemplateId: "",
  landingPageId: "",
  senderIdentityId: "",
};

function EmailPreview({ html, className = "h-[420px] w-full rounded-xl border border-slate-200 bg-white" }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html || "<!doctype html><html><body style=\"font-family:Arial,sans-serif;padding:24px;color:#334155;\"><p>Vyber e-mailovou šablonu pro náhled.</p></body></html>");
    doc.close();
  }, [html]);

  return <iframe ref={iframeRef} title="package-email-preview" className={className} />;
}

function LandingPreview({ html, className = "h-[420px] w-full rounded-xl border border-slate-200 bg-white" }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html || "<!doctype html><html><body style=\"font-family:Arial,sans-serif;padding:24px;color:#334155;\"><p>Vyber landing page pro náhled.</p></body></html>");
    doc.close();
  }, [html]);

  return <iframe ref={iframeRef} title="package-landing-preview" className={className} />;
}

function ConfirmDeleteModal({ open, packName, onConfirm, onCancel, busy }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel, busy]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-950/55 backdrop-blur-[2px]" onClick={() => !busy && onCancel()}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-lg font-semibold text-slate-900">Smazat balíček</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Opravdu chceš smazat balíček <span className="font-semibold text-slate-900">{packName || "Bez názvu"}</span>?
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pokud je balíček navázaný na existující kampaně, backend smazání zablokuje.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {busy ? "Mažu…" : "Smazat"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PackageListCard({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{item.name || "Bez názvu"}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {item.description || item.previewText || "Bez popisu balíčku"}
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          L{item.difficulty || 1}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
        <span className={`rounded-full px-2 py-1 ${item.isApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {item.isApproved ? "Schválený" : "Čeká na schválení"}
        </span>
        <span className={`rounded-full px-2 py-1 ${item.isActive ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-600"}`}>
          {item.isActive ? "Aktivní" : "Neaktivní"}
        </span>
      </div>
    </button>
  );
}

export default function PackagesPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [landingPages, setLandingPages] = useState([]);
  const [senderIdentities, setSenderIdentities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function reload({ keepSelection = true } = {}) {
    const initial = !packages.length && !keepSelection;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [packageRows, templateRows, landingRows, identityRows] = await Promise.all([
        listPackages(),
        listTemplates(),
        listLandingPages(),
        listSenderIdentities(),
      ]);

      const nextPackages = Array.isArray(packageRows) ? packageRows : [];
      setPackages(nextPackages);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setLandingPages(Array.isArray(landingRows) ? landingRows : []);
      setSenderIdentities(Array.isArray(identityRows) ? identityRows : []);

      if (!keepSelection) {
        if (nextPackages.length > 0) {
          applyPackageToForm(nextPackages[0]);
        } else {
          setSelectedId(null);
          setForm(EMPTY_FORM);
        }
        return;
      }

      if (selectedId != null) {
        const selected = nextPackages.find((item) => Number(item.id) === Number(selectedId));
        if (selected) {
          applyPackageToForm(selected);
          return;
        }
      }

      if (nextPackages.length > 0 && !selectedId) {
        applyPackageToForm(nextPackages[0]);
      }
    } catch (e) {
      setError(e.message || "Nepodařilo se načíst balíčky.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    reload({ keepSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeForForm(item) {
    return {
      id: item?.id ?? null,
      name: item?.name || "",
      description: item?.description || "",
      category: item?.category || "",
      difficulty: Number(item?.difficulty || 1),
      previewText: item?.previewText || "",
      isActive: item?.isActive !== false,
      isApproved: item?.isApproved === true,
      emailTemplateId: item?.emailTemplateId ? String(item.emailTemplateId) : "",
      landingPageId: item?.landingPageId ? String(item.landingPageId) : "",
      senderIdentityId: item?.senderIdentityId ? String(item.senderIdentityId) : "",
    };
  }

  function applyPackageToForm(item) {
    setSelectedId(item?.id ?? null);
    setForm(normalizeForForm(item));
    setSuccess(null);
    setError(null);
  }

  function handleField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSuccess(null);
    setError(null);
  }

  function handleNew() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setSuccess(null);
    setError(null);
  }

  const filteredPackages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((item) => {
      const hay = `${item.name || ""} ${item.description || ""} ${item.category || ""} ${item.previewText || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [packages, query]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(form.emailTemplateId)) || null,
    [templates, form.emailTemplateId]
  );

  const selectedLandingPage = useMemo(
    () => landingPages.find((item) => String(item.id) === String(form.landingPageId)) || null,
    [landingPages, form.landingPageId]
  );

  const selectedSenderIdentity = useMemo(
    () => senderIdentities.find((item) => String(item.id) === String(form.senderIdentityId)) || null,
    [senderIdentities, form.senderIdentityId]
  );

  async function onSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: String(form.name || "").trim(),
      description: String(form.description || "").trim(),
      category: String(form.category || "").trim(),
      difficulty: Number(form.difficulty || 1),
      previewText: String(form.previewText || "").trim(),
      isActive: !!form.isActive,
      isApproved: !!form.isApproved,
      emailTemplateId: Number(form.emailTemplateId),
      landingPageId: Number(form.landingPageId),
      senderIdentityId: Number(form.senderIdentityId),
    };

    try {
      let saved;
      if (form.id) {
        saved = await updatePackage(form.id, payload);
        setSuccess(`Balíček „${saved.name}“ byl uložen.`);
      } else {
        saved = await createPackage(payload);
        setSuccess(`Balíček „${saved.name}“ byl vytvořen.`);
      }

      setPackages((prev) => {
        const exists = prev.some((item) => Number(item.id) === Number(saved.id));
        const next = exists
          ? prev.map((item) => (Number(item.id) === Number(saved.id) ? saved : item))
          : [saved, ...prev];
        return next.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "cs"));
      });
      applyPackageToForm(saved);
    } catch (e) {
      setError(e.message || "Balíček se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirmed() {
    if (!form.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextPackages = packages.filter((item) => Number(item.id) !== Number(form.id));
      await deletePackage(form.id);
      setPackages(nextPackages);
      if (nextPackages.length > 0) {
        applyPackageToForm(nextPackages[0]);
      } else {
        setSelectedId(null);
        setForm(EMPTY_FORM);
      }
      setShowDeleteModal(false);
      setSuccess("Balíček byl smazán.");
    } catch (e) {
      setError(e.message || "Balíček se nepodařilo smazat.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-sm text-slate-500">Načítám balíčky…</div>;
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t("nav.content.packages") || "Balíčky"}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Schválené kombinace landing page, e-mailové šablony a odesílací identity. Administrátoři v City pak uvidí pouze tyto hotové balíčky.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reload({ keepSelection: true })}
            disabled={refreshing || saving}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? "Obnovuji…" : "Obnovit"}
          </button>
          <button
            type="button"
            onClick={handleNew}
            disabled={saving}
            className="rounded-lg bg-[var(--brand-strong)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-soft-dark)] disabled:opacity-60"
          >
            Nový balíček
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || success}
        </div>
      )}

      <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Seznam balíčků</div>
              <div className="mt-1 text-xs text-slate-500">Vyber existující balíček nebo založ nový.</div>
            </div>
            <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {packages.length}
            </div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat podle názvu, kategorie nebo popisu"
            className="mt-4 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {filteredPackages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Zatím tu není žádný balíček.
              </div>
            ) : (
              filteredPackages.map((item) => (
                <PackageListCard
                  key={item.id}
                  item={item}
                  active={Number(item.id) === Number(selectedId)}
                  onClick={() => applyPackageToForm(item)}
                />
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <form onSubmit={onSave} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">{form.id ? "Detail balíčku" : "Nový balíček"}</div>
                <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Vyber konkrétní e-mailovou šablonu, landing page a odesílací identitu. V náhledu dole hned uvidíš, co bude v balíčku zafixované.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {form.id ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={saving}
                    className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    Smazat balíček
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-soft-dark)] disabled:opacity-60"
                >
                  {saving ? "Ukládám…" : form.id ? "Uložit změny" : "Vytvořit balíček"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block xl:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Název balíčku</span>
                <input
                  value={form.name}
                  onChange={(e) => handleField("name", e.target.value)}
                  placeholder="Např. M365 reset hesla"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kategorie</span>
                <input
                  value={form.category}
                  onChange={(e) => handleField("category", e.target.value)}
                  placeholder="Např. Identity / HR / Finance"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Obtížnost</span>
                <select
                  value={form.difficulty}
                  onChange={(e) => handleField("difficulty", Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                >
                  <option value={1}>1 — velmi lehká</option>
                  <option value={2}>2 — lehká</option>
                  <option value={3}>3 — střední</option>
                  <option value={4}>4 — náročná</option>
                  <option value={5}>5 — velmi náročná</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Krátký popis</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                placeholder="Pro interní přehled a pozdější orientaci v City."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preview text</span>
              <input
                value={form.previewText}
                onChange={(e) => handleField("previewText", e.target.value)}
                placeholder="Krátké interní shrnutí pro administrátora v City"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">E-mailová šablona</span>
                <select
                  value={form.emailTemplateId}
                  onChange={(e) => handleField("emailTemplateId", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                >
                  <option value="">Vyber šablonu</option>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Landing page</span>
                <select
                  value={form.landingPageId}
                  onChange={(e) => handleField("landingPageId", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                >
                  <option value="">Vyber landing page</option>
                  {landingPages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Odesílací identita</span>
                <select
                  value={form.senderIdentityId}
                  onChange={(e) => handleField("senderIdentityId", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
                >
                  <option value="">Vyber identitu</option>
                  {senderIdentities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!form.isActive}
                  onChange={(e) => handleField("isActive", e.target.checked)}
                  className="mt-1 size-4 rounded border-slate-300 text-[var(--brand-strong)] focus:ring-[var(--brand-strong)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Balíček je aktivní</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Aktivní balíček může být nabídnutý dál do City, pokud je zároveň schválený.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!form.isApproved}
                  onChange={(e) => handleField("isApproved", e.target.checked)}
                  className="mt-1 size-4 rounded border-slate-300 text-[var(--brand-strong)] focus:ring-[var(--brand-strong)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Balíček je schválený</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Jen schválené balíčky se mají později zobrazovat administrátorům ve 4Cyber City.
                  </span>
                </span>
              </label>
            </div>
          </form>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">E-mailová šablona</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedTemplate ? `${selectedTemplate.name} · ${selectedTemplate.subject || "bez předmětu"}` : "Zatím není vybraná žádná šablona."}
                  </div>
                </div>
                {selectedTemplate?.tags?.length ? (
                  <div className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    {selectedTemplate.tags.slice(0, 2).join(", ")}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 overflow-hidden rounded-xl bg-white">
                <EmailPreview html={selectedTemplate?.bodyHtml} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Landing page</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedLandingPage ? `${selectedLandingPage.name} · /lp/${selectedLandingPage.urlSlug}` : "Zatím není vybraná žádná landing page."}
                  </div>
                </div>
                {selectedLandingPage?.tags?.length ? (
                  <div className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                    {selectedLandingPage.tags.slice(0, 2).join(", ")}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 overflow-hidden rounded-xl bg-white">
                <LandingPreview html={selectedLandingPage?.html} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Souhrn balíčku</div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kategorie</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{form.category || "Bez kategorie"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Obtížnost</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Level {form.difficulty || 1}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Identita</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{selectedSenderIdentity?.name || "Nevybraná"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedSenderIdentity
                    ? `${selectedSenderIdentity.fromName || ""}${selectedSenderIdentity.fromName ? " · " : ""}${selectedSenderIdentity.localPart || ""}${selectedSenderIdentity.senderDomain?.domain ? `@${selectedSenderIdentity.senderDomain.domain}` : ""}`
                    : "Vyber odesílací identitu"}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stav</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className={`rounded-full px-2 py-1 ${form.isActive ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-600"}`}>
                    {form.isActive ? "Aktivní" : "Neaktivní"}
                  </span>
                  <span className={`rounded-full px-2 py-1 ${form.isApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {form.isApproved ? "Schválený" : "Čeká na schválení"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDeleteModal
        open={showDeleteModal}
        packName={form.name}
        busy={saving}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={onDeleteConfirmed}
      />
    </div>
  );
}
