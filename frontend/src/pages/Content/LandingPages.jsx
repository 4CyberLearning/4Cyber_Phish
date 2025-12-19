import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from "../../api/landingPages";

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
      className="h-full w-full rounded-lg border border-gray-200 bg-white"
    />
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
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {t("content.landingPages.title") || "Landing pages"}
            </h1>
            <p className="mt-1 text-xs text-gray-500 max-w-2xl">
              {t("content.landingPages.description") ||
                "Tady připravíš HTML cílových stránek, které se zobrazí po kliknutí z phishingového e-mailu."}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
        <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-gray-500">
              {t("common.loading")}
            </div>
          ) : pages.length === 0 ? (
            <div className="text-sm text-gray-500">
              {t("content.landingPages.empty") || "Zatím nemáš žádné landing pages."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`flex flex-col rounded-lg border px-3 py-2 text-sm hover:border-[var(--brand-strong)] ${
                    page.id === selectedId
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                      : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setSelectedId(page.id)}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {page.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        /lp/{page.urlSlug}
                      </div>
                    </div>
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

                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAsBase(page);
                      }}
                      className="flex-1 rounded-md border border-[var(--brand-strong)] px-2 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                    >
                      {t("content.landingPages.actions.useAsBase") || "Použít jako základ"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(page);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                    >
                      {t("content.landingPages.actions.editOriginal") || "Editovat"}
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
              <div className="grid grid-cols-[2fr,1fr] gap-3">
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
            </div>

            <div className="flex-1 p-3">
              {activeTab === "html" && (
                <textarea
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
    </div>
  );
}
