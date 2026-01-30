import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from "../../api/landingPages";
import AssetPickerModal from "../../components/AssetPickerModal";
import { LANDING_PAGES_HELP } from "./landingPagesHelpContent";
import { updateCampaign } from "../../api/campaigns";

const EMPTY_PAGE = {
  id: null,
  name: "",
  urlSlug: "",
  html: "",
  tags: [],
};

function LandingPreview({ html }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      html ||
        "<!doctype html><html><body><p>No content.</p></body></html>"
    );
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="landing-preview"
      className="w-full h-[75vh] rounded-lg border border-gray-200 bg-white"
    />
  );
}

function LandingPagePreviewModal({ open, onClose, title, html }) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/60" onClick={onClose}>
      <div className="h-full w-full overflow-y-auto p-4">
        <div
          className="mx-auto mt-10 w-[70vw] max-w-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold truncate">
                {title || "Náhled landing page"}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Zavřít
              </button>
            </div>

            <div className="p-4">
              <iframe
                title="landing-preview-modal"
                srcDoc={html || "<!doctype html><html><body><p>No content.</p></body></html>"}
                className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LandingPagesHelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/40" onClick={onClose}>
      <div className="h-full w-full overflow-y-auto p-4">
        <div
          className="mx-auto mt-10 w-full max-w-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold">Nápověda k landing pages</div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Zavřít
              </button>
            </div>

            <div className="px-4 py-4 text-sm text-gray-800">
              <div className="mb-3 text-xs text-gray-500">{LANDING_PAGES_HELP.intro}</div>

              <h3 className="mb-1 text-sm font-semibold">1) Tracking</h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {LANDING_PAGES_HELP.tracking.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              <h3 className="mb-1 text-sm font-semibold">2) Doporučení</h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {LANDING_PAGES_HELP.rules.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              <h3 className="mb-1 text-sm font-semibold">3) Mini příklad</h3>
              <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed">
                {LANDING_PAGES_HELP.example}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function LandingPagesPage() {
  const { t } = useTranslation();
  const [pages, setPages] = useState([]);
  const [viewMode, setViewMode] = useState("select"); // "select" | "edit"
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("html"); // "html" | "preview"
  const htmlRef = useRef(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewState, setPreviewState] = useState({ open: false, title: "", html: "" });
  const [helpOpen, setHelpOpen] = useState(false);
  const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
  const CAMPAIGN_UPDATED_EVENT = "campaign:updated";

  const [applyingCampaign, setApplyingCampaign] = useState(false);

  async function applyToCampaign(page) {
    const campaignId = localStorage.getItem(SELECTED_CAMPAIGN_KEY);
    if (!campaignId) {
      window.alert("Nejdřív vyber kampaň v horním panelu.");
      return;
    }

    setApplyingCampaign(true);
    setError(null);
    setSuccess(null);

    try {
      await updateCampaign(Number(campaignId), { landingPageId: Number(page.id) });
      window.dispatchEvent(
        new CustomEvent(CAMPAIGN_UPDATED_EVENT, { detail: { id: String(campaignId), step: "landing" } })
      );
      setSuccess("Landing page byla nastavena pro vybranou kampaň.");
    } catch (e) {
      setError(e?.message || "Nepodařilo se nastavit landing page pro kampaň");
    } finally {
      setApplyingCampaign(false);
    }
  }

  function insertIntoHtmlAtCursor(snippet) {
    const el = htmlRef.current;
    const value = form.html || "";

    if (!el || typeof el.selectionStart !== "number") {
      // fallback: append
      setField("html", value + "\n" + snippet);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;

    const next = value.slice(0, start) + snippet + value.slice(end);
    setField("html", next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handlePickAsset(url) {
    const snippet = `<img src="${url}" alt="" style="max-width:100%; height:auto;" />`;
    insertIntoHtmlAtCursor(snippet);
  }

  function openPreview(page) {
    setSelectedId(page.id);
    setPreviewState({
      open: true,
      title: page?.name || "Náhled landing page",
      html: page?.html || "",
    });
  }

  function closePreview() {
    setPreviewState((p) => ({ ...p, open: false }));
  }

  const filteredPages = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return pages;

    return pages.filter((p) => {
      const tags = Array.isArray(p.tags) ? p.tags.join(" ") : "";
      const hay = `${p.name || ""} ${p.urlSlug || ""} ${tags}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pages, searchQuery]);

  useEffect(() => {
    loadPages();
  }, []);

  async function loadPages() {
    setLoading(true);
    setError(null);
    try {
      const data = await listLandingPages();
      setPages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteFromList(page) {
    if (!page?.id) return;
    if (!window.confirm("Smazat landing page?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteLandingPage(page.id);
      await loadPages();
      if (selectedId === page.id) setSelectedId(null);
      setSuccess(t("content.landingPages.messages.deleted") || "Deleted");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleNew() {
    setForm(EMPTY_PAGE);
    setSelectedId(null);
    setSuccess(null);
    setError(null);
    setActiveTab("html");
    setViewMode("edit");
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit(page) {
    setSelectedId(page.id);
    setForm({
      id: page.id,
      name: page.name || "",
      urlSlug: page.urlSlug || "",
      html: page.html || "",
      tags: page.tags || [],
    });
    setSuccess(null);
    setError(null);
    setActiveTab("html");
    setViewMode("edit");
  }

  function handleUseAsBase(page) {
    setSelectedId(page.id);
    setForm({
      id: null,
      name: `${page.name} (copy)`,
      urlSlug: "",
      html: page.html || "",
      tags: page.tags || [],
    });
    setSuccess(null);
    setError(null);
    setActiveTab("html");
    setViewMode("edit");
  }

  async function handleSave() {
    const name = (form.name || "").trim();
    const slugInput = (form.urlSlug || "").trim();

    if (!name) {
      setError(t("content.landingPages.messages.nameRequired") || "Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const tagsValue =
        typeof form.tags === "string"
          ? form.tags
          : Array.isArray(form.tags)
          ? form.tags.join(", ")
          : "";

      const payload = {
        name,
        urlSlug: slugInput,
        html: form.html,
        tags: tagsValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      let saved;
      if (form.id) {
        saved = await updateLandingPage(form.id, payload);
      } else {
        saved = await createLandingPage(payload);
      }

      await loadPages();
      if (saved && saved.id) {
        setForm({
          id: saved.id,
          name: saved.name || "",
          urlSlug: saved.urlSlug || "",
          html: saved.html || "",
          tags: saved.tags || [],
        });
        setSelectedId(saved.id);
      }

      setSuccess(t("content.landingPages.messages.saved") || "Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsCopy() {
    if (!form.name && !form.html) {
      setError(
        t("content.landingPages.messages.saveBeforeCopy") ||
          "Fill in landing page before saving copy"
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const tagsValue =
        typeof form.tags === "string"
          ? form.tags
          : Array.isArray(form.tags)
          ? form.tags.join(", ")
          : "";

      const payload = {
        name: `${form.name.trim() || "Landing page"} (copy)`,
        urlSlug: "",
        html: form.html,
        tags: tagsValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const saved = await createLandingPage(payload);
      await loadPages();

      if (saved && saved.id) {
        setForm({
          id: saved.id,
          name: saved.name || "",
          urlSlug: saved.urlSlug || "",
          html: saved.html || "",
          tags: saved.tags || [],
        });
        setSelectedId(saved.id);
      }

      setSuccess(t("content.landingPages.messages.saved") || "Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (
      !window.confirm(
        t("content.landingPages.messages.confirmDelete") ||
          "Delete this landing page?"
      )
    )
      return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteLandingPage(form.id);
      await loadPages();
      handleNew();
      setSuccess(t("content.landingPages.messages.deleted") || "Deleted");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const tagsString =
    typeof form.tags === "string"
      ? form.tags
      : Array.isArray(form.tags)
      ? form.tags.join(", ")
      : "";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* hlavička */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {t("content.landingPages.title") || "Landing pages"}
            </h1>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50"
              title="Nápověda"
            >
              ?
            </button>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === "select" && (
              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hledat (název, slug, tag)…"
                  className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    title="Vymazat"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("select")}
                className={`rounded-full px-3 py-1.5 ${
                  viewMode === "select"
                    ? "bg-[var(--brand-strong)] text-white"
                    : "text-gray-600"
                }`}
              >
                {t("content.landingPages.view.select") || "Výběr stránek"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={`rounded-full px-3 py-1.5 ${
                  viewMode === "edit"
                    ? "bg-[var(--brand-strong)] text-white"
                    : "text-gray-600"
                }`}
              >
                {t("content.landingPages.view.edit") || "Editor"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleNew}
              className="rounded-full bg-[var(--brand-strong)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-soft-dark)]"
            >
              {t("content.landingPages.actions.newBlank") || "Nová prázdná stránka"}
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

      {/* výběr existujících stránek */}
      {viewMode === "select" && (
        <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-gray-500">
              {t("common.loading")}
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="text-sm text-gray-500">
              {t("content.landingPages.empty") || "Zatím nemáš žádné landing pages."}
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] sm:[grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
              {filteredPages.map((page) => (
                <div
                  key={page.id}
                  className={`flex flex-col rounded-xl border bg-white p-3 text-sm shadow-sm transition hover:shadow-md hover:border-[var(--brand-strong)] ${
                    page.id === selectedId
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                      : "border-gray-200"
                  }`}
                  onClick={() => setSelectedId(page.id)}
                >
                  <div className="mb-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900">{page.name}</div>
                      <div className="truncate text-xs text-gray-500">/lp/{page.urlSlug}</div>
                    </div>

                    <button
                      type="button"
                      className="mt-2 w-full overflow-hidden rounded-md border border-gray-200 bg-white hover:border-[var(--brand-strong)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(page);
                      }}
                      title="Klikni pro náhled"
                    >
                      <div className="flex h-[120px] w-full items-center justify-center bg-gray-50">
                        <iframe
                          title={`lp-thumb-${page.id}`}
                          sandbox=""
                          srcDoc={page.html || "<!doctype html><html><body><p>No content.</p></body></html>"}
                          className="pointer-events-none"
                          style={{
                            width: 1200,
                            height: 800,
                            transform: "scale(0.14)",
                            transformOrigin: "center",
                            border: 0,
                          }}
                        />
                      </div>
                    </button>
                  </div>

                  {page.tags && page.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {page.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto grid grid-cols-4 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAsBase(page);
                      }}
                      className="rounded-md border border-[var(--brand-strong)] px-2 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                    >
                      {t("content.landingPages.actions.useAsBase") || "Použít jako základ"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(page);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      {t("content.landingPages.actions.editOriginal") || "Editovat"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFromList(page);
                      }}
                      disabled={saving}
                      className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {t("common.delete") || "Smazat"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyToCampaign(page);
                      }}
                      disabled={applyingCampaign}
                      className="rounded-md border border-slate-200/70 bg-white/20 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      Do kampaně
                    </button>                    
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* editor */}
      {viewMode === "edit" && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {t("content.landingPages.fields.name") || "Název"}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {t("content.landingPages.fields.slug") || "Slug / URL část"}
                  </label>
                  <input
                    type="text"
                    value={form.urlSlug}
                    onChange={(e) => setField("urlSlug", e.target.value)}
                    placeholder="např. security-check"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t("content.landingPages.fields.tags") || "Tagy"}
                </label>
                <input
                  type="text"
                  value={tagsString}
                  onChange={(e) => setField("tags", e.target.value)}
                  placeholder={
                    t("content.landingPages.fields.tagsPlaceholder") ||
                    "např. office365, login, spear-phishing"
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>

              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {t("content.landingPages.actions.save") || "Uložit"}
                  </button>

                  {form.id && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveAsCopy}
                        disabled={saving}
                        className="rounded-md border border-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                      >
                        {t("content.landingPages.actions.saveCopy") || "Uložit kopii"}
                      </button>

                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {t("common.delete") || "Smazat"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="flex min-h-[520px] flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-gray-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("html")}
                className={`px-4 py-2 ${
                  activeTab === "html"
                    ? "border-b-2 border-[var(--brand-strong)] text-[var(--brand-strong)]"
                    : "text-gray-500"
                }`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 ${
                  activeTab === "preview"
                    ? "border-b-2 border-[var(--brand-strong)] text-[var(--brand-strong)]"
                    : "text-gray-500"
                }`}
              >
                {t("content.landingPages.preview.title") || "Náhled"}
              </button>
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="ml-auto mr-3 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Vložit obrázek
              </button>              
            </div>

            <div className="flex-1 p-3">
              {activeTab === "html" && (
                <textarea
                  ref={htmlRef}
                  value={form.html}
                  onChange={(e) => setField("html", e.target.value)}
                  className="h-full min-h-[420px] w-full resize-none rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder={t("content.landingPages.preview.empty") || "<html>..."}
                />
              )}

              {activeTab === "preview" && (
                form.html ? (
                  <LandingPreview html={form.html} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    {t("content.landingPages.preview.empty") || "Zatím žádný obsah k zobrazení."}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
      <AssetPickerModal
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onPick={handlePickAsset}
      />
      <LandingPagePreviewModal
        open={previewState.open}
        onClose={closePreview}
        title={previewState.title}
        html={previewState.html}
      />  
      <LandingPagesHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />    
    </div>
  );
}
