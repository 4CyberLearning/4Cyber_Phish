import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendTemplateTest,
} from "../../api/templates";
import { uploadAsset } from "../../api/assets";

const EMPTY_TEMPLATE = {
  id: null,
  name: "",
  subject: "",
  bodyHtml: "",
  tags: [],
  difficulty: 1,
};

const buildQuillModules = (handleImage) => ({
  toolbar: {
    container: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["clean"],
    ],
    handlers: {
      image: handleImage,
    },
  },
});

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "link",
  "image",
];

function EmailPreview({ html }) {
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
      title="email-preview"
      className="w-full h-[600px] rounded-lg border border-gray-200 bg-white"
    />
  );
}

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const quillRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [viewMode, setViewMode] = useState("select"); // "select" | "edit"
  const [selectedTemplateId, setSelectedTemplateId] = useState(null); // pro zvýraznění v seznamu
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("editor"); // "editor" | "html" | "preview"

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setForm(EMPTY_TEMPLATE);
    setTestEmail("");
    setSuccess(null);
    setError(null);
    setActiveTab("html");
    setViewMode("edit");
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleImageUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const asset = await uploadAsset(file);
        const quill = quillRef.current?.getEditor();
        if (!quill || !asset?.url) return;

        const range = quill.getSelection(true);
        const index = range ? range.index : 0;

        quill.insertEmbed(index, "image", asset.url);
        quill.setSelection(index + 1);
      } catch (e) {
        console.error(e);
        setError(e.message || "Image upload failed");
      }
    };

    input.click();
  }

  // použít existující šablonu jako základ (KLON) pro novou
  function handleUseAsBase(tpl) {
    setSelectedTemplateId(tpl.id);
    setForm({
      id: null, // nová šablona
      name: `${tpl.name} (copy)`,
      subject: tpl.subject || "",
      bodyHtml: tpl.bodyHtml || "",
      tags: tpl.tags || [],
      difficulty: tpl.difficulty ?? 1,
    });
    setActiveTab("html");
    setSuccess(null);
    setError(null);
    setViewMode("edit");
  }

  // editovat originální šablonu z knihovny
  function handleEditOriginal(tpl) {
    setSelectedTemplateId(tpl.id);
    setForm({
      id: tpl.id,
      name: tpl.name || "",
      subject: tpl.subject || "",
      bodyHtml: tpl.bodyHtml || "",
      tags: tpl.tags || [],
      difficulty: tpl.difficulty ?? 1,
    });
    setActiveTab("html");
    setSuccess(null);
    setError(null);
    setViewMode("edit");
  }

  async function handleSave() {
    const name = (form.name || "").trim();
    const subject = (form.subject || "").trim();

    if (!name) {
      setError(t("content.emailTemplates.messages.nameRequired"));
      return;
    }

    // zjistíme, jestli existuje jiná šablona se stejným názvem
    const duplicate = templates.find(
      (tpl) =>
        tpl.name.trim().toLowerCase() === name.toLowerCase() &&
        tpl.id !== form.id
    );

    let ok = false;
    if (duplicate) {
      ok = window.confirm(
        t("content.emailTemplates.messages.confirmOverwrite", {
          name,
          subject: subject || t("content.emailTemplates.messages.noSubject")
        })
      );
    } else {
      ok = window.confirm(
        t("content.emailTemplates.messages.confirmSave", {
          name,
          subject: subject || t("content.emailTemplates.messages.noSubject")
        })
      );
    }

    if (!ok) return;

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
        subject,
        bodyHtml: form.bodyHtml,
        tags: tagsValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        difficulty: Number(form.difficulty) || 1,
      };

      let saved;
      if (form.id) {
        // úprava existující šablony z knihovny
        saved = await updateTemplate(form.id, payload);
      } else {
        // nová šablona (např. pro tuto kampaň / nový vzor)
        saved = await createTemplate(payload);
      }

      await loadTemplates();
      if (saved && saved.id) {
        setForm({
          id: saved.id,
          name: saved.name || "",
          subject: saved.subject || "",
          bodyHtml: saved.bodyHtml || "",
          tags: saved.tags || [],
          difficulty: saved.difficulty ?? 1,
        });
      }
      setSuccess(t("content.emailTemplates.messages.saved"));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsCopy() {
    if (!form.name && !form.subject && !form.bodyHtml) {
      setError(t("content.emailTemplates.messages.saveBeforeTest"));
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
        name: `${form.name.trim() || t("content.emailTemplates.title")} (copy)`,
        subject: form.subject.trim(),
        bodyHtml: form.bodyHtml,
        tags: tagsValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        difficulty: Number(form.difficulty) || 1,
      };

      const saved = await createTemplate(payload);

      await loadTemplates();
      if (saved && saved.id) {
        setForm({
          id: saved.id,
          name: saved.name || "",
          subject: saved.subject || "",
          bodyHtml: saved.bodyHtml || "",
          tags: saved.tags || [],
          difficulty: saved.difficulty ?? 1,
        });
      }
      setSuccess(t("content.emailTemplates.messages.saved"));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (!window.confirm(t("content.emailTemplates.messages.confirmDelete")))
      return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteTemplate(form.id);
      await loadTemplates();
      handleNew();
      setSuccess(t("content.emailTemplates.messages.deleted"));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!form.id) {
      setError(t("content.emailTemplates.messages.saveBeforeTest"));
      return;
    }
    if (!testEmail) {
      setError(t("content.emailTemplates.messages.testEmailRequired"));
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      await sendTemplateTest(form.id, testEmail);
      setSuccess(t("content.emailTemplates.messages.testSent"));
      setActiveTab("preview");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
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
      {/* hlavička + přepínač režimu */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-gray-900">
              {t("content.emailTemplates.title")}
            </h1>
            <p className="text-xs text-gray-500">
              Dostupné proměnné v šabloně:&nbsp;
              <code>{"{{name}}"}</code>,{" "}
              <code>{"{{email}}"}</code>,{" "}
              <code>{"{{link}}"}</code>
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
                {t("content.emailTemplates.view.select") || "Výběr šablon"}
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
                {t("content.emailTemplates.view.edit") || "Editor"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleNew}
              className="rounded-full bg-[var(--brand-strong)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-soft-dark)]"
            >
              {t("content.emailTemplates.actions.newBlank") || t("common.new")}
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

      {/* REŽIM: VÝBĚR ŠABLON */}
      {viewMode === "select" && (
        <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="text-sm text-gray-500">
              {t("common.loading")}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-gray-500">
              {t("content.emailTemplates.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`flex flex-col rounded-lg border px-3 py-2 text-sm hover:border-[var(--brand-strong)] ${
                    tpl.id === selectedTemplateId
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                      : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {tpl.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tpl.subject}
                      </div>
                    </div>
                    {tpl.difficulty != null && (
                      <div className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {t(
                          "content.emailTemplates.fields.difficulty"
                        ) || "Diff"}
                        : {tpl.difficulty}
                      </div>
                    )}
                  </div>

                  {tpl.tags && tpl.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {tpl.tags.map((tag) => (
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
                        handleUseAsBase(tpl);
                      }}
                      className="flex-1 rounded-md border border-[var(--brand-strong)] px-2 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                    >
                      {t(
                        "content.emailTemplates.actions.useAsBase"
                      ) || "Použít jako základ"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditOriginal(tpl);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                    >
                      {t(
                        "content.emailTemplates.actions.editOriginal"
                      ) || "Editovat"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REŽIM: EDITOR */}
        {viewMode === "edit" && (
          <>
            {/* metadata + akce */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
              >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t("content.emailTemplates.fields.name")}
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
                  {t("content.emailTemplates.fields.subject")}
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setField("subject", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[2fr,1fr] gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t("content.emailTemplates.fields.tags")}
                </label>
                <input
                  type="text"
                  value={tagsString}
                  onChange={(e) => setField("tags", e.target.value)}
                  placeholder={t(
                    "content.emailTemplates.fields.tagsPlaceholder"
                  )}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t("content.emailTemplates.fields.difficulty")}
                </label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setField("difficulty", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  {t("content.emailTemplates.actions.save")}
                </button>

                {form.id && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveAsCopy}
                      disabled={saving}
                      className="rounded-md border border-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                    >
                      {t("content.emailTemplates.actions.saveCopy")}
                    </button>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {t("common.delete")}
                    </button>
                  </>
                )}
              </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder={t(
                      "content.emailTemplates.fields.testEmailPlaceholder"
                    )}
                    className="w-52 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  />
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={sending}
                    className="rounded-md border border-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                  >
                    {t("content.emailTemplates.actions.sendTest")}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* HTML / Preview tabbed editor */}
          <div className="flex min-h-[520px] flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center border-b border-gray-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-4 py-2 ${
                  activeTab === "editor"
                    ? "border-b-2 border-[var(--brand-strong)] text-[var(--brand-strong)]"
                    : "text-gray-500"
                }`}
              >
                {t("content.emailTemplates.view.edit") || "Editor"}
              </button>
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
                {t("content.emailTemplates.preview.title")}
              </button>
            </div>

            <div className="flex-1 p-3">
              {activeTab === "editor" && (
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={form.bodyHtml}
                  onChange={(value) => setField("bodyHtml", value)}
                  modules={buildQuillModules(handleImageUpload)}
                  formats={quillFormats}
                  className="h-full min-h-[420px]"
                />
              )}

              {activeTab === "html" && (
                <textarea
                  value={form.bodyHtml}
                  onChange={(e) => setField("bodyHtml", e.target.value)}
                  className="h-full min-h-[420px] w-full resize-none rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
                  placeholder={t("content.emailTemplates.preview.empty")}
                />
              )}

              {activeTab === "preview" && (
                form.bodyHtml ? (
                  <EmailPreview html={form.bodyHtml} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    {t("content.emailTemplates.preview.empty")}
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
