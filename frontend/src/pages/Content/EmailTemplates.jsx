import { useEffect, useMemo, useRef, useState } from "react";
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
import AssetPickerModal from "../../components/AssetPickerModal";
import { EMAIL_TEMPLATES_HELP } from "./emailTemplatesHelpContent";
import { createPortal } from "react-dom";
import { updateCampaign } from "../../api/campaigns";
import { useCurrentCampaign } from "../../hooks/useCurrentCampaign";

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

function EmailPreview({ html, className = "w-full h-[600px] rounded-lg border border-gray-200 bg-white" }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html || "<!doctype html><html><body><p>No content.</p></body></html>");
    doc.close();
  }, [html]);

  return <iframe ref={iframeRef} title="email-preview" className={className} />;
}

function TemplateHelpModal({ open, onClose }) {
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
    <div
      className="fixed inset-0 z-[999999] bg-black/50"
      onClick={onClose}
    >
      <div className="h-full w-full overflow-y-auto p-4">
        <div
          className="mx-auto mt-10 w-full max-w-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold">Nápověda k e-mailovým šablonám</div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Zavřít
              </button>
            </div>

            <div className="px-4 py-4 text-sm text-gray-800">
              <div className="mb-3 text-xs text-gray-500">{EMAIL_TEMPLATES_HELP.intro}</div>

              <h3 className="mb-1 text-sm font-semibold">1) Proměnné</h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {EMAIL_TEMPLATES_HELP.variables.map((v) => (
                  <li key={v.key}>
                    <code>{v.key}</code> – {v.desc}
                  </li>
                ))}
              </ul>

              <h3 className="mb-1 text-sm font-semibold">2) Tracking</h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {EMAIL_TEMPLATES_HELP.tracking.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              <h3 className="mb-1 text-sm font-semibold">3) Doporučené HTML zásady</h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {EMAIL_TEMPLATES_HELP.htmlRules.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              <h3 className="mb-1 text-sm font-semibold">4) Příklad</h3>
              <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed">
                {EMAIL_TEMPLATES_HELP.example}
              </pre>

              <div className="mt-4 text-xs text-gray-500">{EMAIL_TEMPLATES_HELP.note}</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TemplatePreviewModal({ open, onClose, title, html }) {
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
    <div
      className="fixed inset-0 z-[999999] bg-black/60"
      onClick={onClose}
    >
      <div className="h-full w-full overflow-y-auto p-4">
        <div
          className="mx-auto mt-10 w-full max-w-[1100px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold truncate">
                {title || "Náhled šablony"}
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
              <EmailPreview
                html={html}
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

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const quillRef = useRef(null);

  const { hasCampaign, campaign } = useCurrentCampaign();
  const campaignEmailTemplateId = campaign?.emailTemplateId ?? campaign?.emailTemplate?.id;
  const isInCurrentCampaign = (tplId) => hasCampaign && Number(campaignEmailTemplateId) === Number(tplId);

  const [templates, setTemplates] = useState([]);
  const [viewMode, setViewMode] = useState("select"); // "select" | "edit"
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [activeTab, setActiveTab] = useState("editor"); // "editor" | "html" | "preview"
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  // NEW: vyhledávání v select view
  const [searchQuery, setSearchQuery] = useState("");

  // NEW: help + preview modaly
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewState, setPreviewState] = useState({ open: false, title: "", html: "" });
  const SELECTED_CAMPAIGN_KEY = "campaign.selected.v1";
  const CAMPAIGN_UPDATED_EVENT = "campaign:updated";

  const [applyingCampaign, setApplyingCampaign] = useState(false);

  async function applyToCampaign(tpl) {
    const campaignId = localStorage.getItem(SELECTED_CAMPAIGN_KEY);
    if (!campaignId || campaignId === "__none__") {
      window.alert("Nejdřív vyber kampaň v horním panelu.");
      return;
    }

    setApplyingCampaign(true);
    setError(null);
    setSuccess(null);

    try {
      await updateCampaign(Number(campaignId), { emailTemplateId: Number(tpl.id) });
      window.dispatchEvent(
        new CustomEvent(CAMPAIGN_UPDATED_EVENT, { detail: { id: String(campaignId), step: "email" } })
      );
      setSuccess("E-mail šablona byla nastavena pro vybranou kampaň.");
    } catch (e) {
      setError(e?.message || "Nepodařilo se nastavit e-mail šablonu pro kampaň");
    } finally {
      setApplyingCampaign(false);
    }
  }

  function openPreview(tpl) {
    setSelectedTemplateId(tpl.id);
    setPreviewState({
      open: true,
      title: tpl?.name || "Náhled šablony",
      html: tpl?.bodyHtml || "",
    });
  }

  function closePreview() {
    setPreviewState((p) => ({ ...p, open: false }));
  }

  function handlePickAsset(url) {
    const quill = quillRef.current?.getEditor();
    if (!quill || !url) return;

    const range = quill.getSelection(true);
    const index = range ? range.index : 0;

    quill.insertEmbed(index, "image", url);
    quill.setSelection(index + 1);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return templates;

    return templates.filter((tpl) => {
      const tags = Array.isArray(tpl.tags) ? tpl.tags.join(" ") : "";
      const hay = `${tpl.name || ""} ${tpl.subject || ""} ${tags}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, searchQuery]);

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

  function handleImageUpload() {
    setAssetPickerOpen(true);
  }

  function handleUseAsBase(tpl) {
    setSelectedTemplateId(tpl.id);
    setForm({
      id: null,
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

  async function handleDeleteFromList(tpl) {
    if (!tpl?.id) return;
    if (!window.confirm(t("content.emailTemplates.messages.confirmDelete") || "Smazat šablonu?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteTemplate(tpl.id);
      await loadTemplates();
      if (selectedTemplateId === tpl.id) setSelectedTemplateId(null);
      setSuccess(t("content.emailTemplates.messages.deleted") || "Smazáno");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const name = (form.name || "").trim();
    const subject = (form.subject || "").trim();

    if (!name) {
      setError(t("content.emailTemplates.messages.nameRequired"));
      return;
    }

    const duplicate = templates.find(
      (tpl) => tpl.name.trim().toLowerCase() === name.toLowerCase() && tpl.id !== form.id
    );

    const ok = duplicate
      ? window.confirm(
          t("content.emailTemplates.messages.confirmOverwrite", {
            name,
            subject: subject || t("content.emailTemplates.messages.noSubject"),
          })
        )
      : window.confirm(
          t("content.emailTemplates.messages.confirmSave", {
            name,
            subject: subject || t("content.emailTemplates.messages.noSubject"),
          })
        );

    if (!ok) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tagsValue =
        typeof form.tags === "string" ? form.tags : Array.isArray(form.tags) ? form.tags.join(", ") : "";

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

      const saved = form.id ? await updateTemplate(form.id, payload) : await createTemplate(payload);

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
        typeof form.tags === "string" ? form.tags : Array.isArray(form.tags) ? form.tags.join(", ") : "";

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
    if (!window.confirm(t("content.emailTemplates.messages.confirmDelete"))) return;

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
    typeof form.tags === "string" ? form.tags : Array.isArray(form.tags) ? form.tags.join(", ") : "";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* hlavička + přepínač režimu + search + help */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {t("content.emailTemplates.title")}
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
          </div>

          <div className="flex items-center gap-3">
            {viewMode === "select" && (
              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hledat (název, předmět, tag)…"
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
            <div className="text-sm text-gray-500">{t("common.loading")}</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-sm text-gray-500">
              {templates.length === 0 ? t("content.emailTemplates.empty") : "Nic nenalezeno."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`relative flex flex-col rounded-xl border px-3 py-2 text-sm shadow-sm transition hover:shadow-md hover:border-[var(--brand-strong)] ${
                      tpl.id === selectedTemplateId
                        ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]"
                        : "border-gray-300/70 bg-white"
                    } ${
                      isInCurrentCampaign(tpl.id)
                        ? "border-[var(--brand-strong)] bg-[var(--brand-soft)]/30 shadow-[0_0_0_1px_rgba(46,36,211,0.25),0_0_16px_rgba(71,101,238,0.18)]"
                        : ""
                    }`}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                  >
                    {isInCurrentCampaign(tpl.id) && (
                      <span className="absolute right-2 top-2 rounded-full bg-[var(--brand-strong)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-strong)] ring-1 ring-[var(--brand-strong)]/25">
                        V aktuální kampani
                      </span>
                    )}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900">{tpl.name}</div>
                      <div className="text-xs text-gray-500">{tpl.subject}</div>
                    </div>
                    {tpl.difficulty != null && (
                      <div className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {t("content.emailTemplates.fields.difficulty") || "Diff"}: {tpl.difficulty}
                      </div>
                    )}
                  </div>

                  {/* drobný náhled + klik pro zvětšení */}
                  <div
                    className="mb-2 overflow-hidden rounded-md border border-gray-200 bg-white hover:border-[var(--brand-strong)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(tpl);
                    }}
                    title="Klikni pro náhled"
                  >
                    <div className="relative h-[110px] w-full bg-gray-50">
                      <iframe
                        title={`tpl-thumb-${tpl.id}`}
                        sandbox=""
                        srcDoc={
                          tpl.bodyHtml ||
                          "<!doctype html><html><body><p style='font-family:Arial'>No content.</p></body></html>"
                        }
                        className="pointer-events-none absolute"
                        style={{
                          width: 600,
                          height: 440,
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%) scale(0.25)",
                          transformOrigin: "center",
                          border: 0,
                        }}
                      />
                    </div>
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

                  {/* 3 tlačítka: použít / editovat / smazat */}
                  <div className={`mt-auto grid gap-2 pt-2 ${hasCampaign ? "grid-cols-4" : "grid-cols-3"}`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAsBase(tpl);
                      }}
                      className="rounded-md border border-[var(--brand-strong)] px-2 py-1 text-[11px] font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                    >
                      {t("content.emailTemplates.actions.useAsBase") || "Použít jako základ"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditOriginal(tpl);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      {t("content.emailTemplates.actions.editOriginal") || "Editovat"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFromList(tpl);
                      }}
                      disabled={saving}
                      className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {t("common.delete") || "Smazat"}
                    </button>
                    {hasCampaign && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyToCampaign(tpl);
                        }}
                        disabled={applyingCampaign || isInCurrentCampaign(tpl.id)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-60 ${
                          isInCurrentCampaign(tpl.id)
                            ? "border-[var(--brand-strong)]/25 bg-[var(--brand-soft)] text-[var(--brand-strong)] dark:bg-white/10"
                            : "border-slate-200/70 bg-white/20 text-slate-700 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        }`}
                      >
                        {isInCurrentCampaign(tpl.id) ? "V kampani" : "Do kampaně"}
                      </button>
                    )}
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
                    placeholder={t("content.emailTemplates.fields.tagsPlaceholder")}
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
                    placeholder={t("content.emailTemplates.fields.testEmailPlaceholder")}
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

              {activeTab === "preview" &&
                (form.bodyHtml ? (
                  <EmailPreview html={form.bodyHtml} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    {t("content.emailTemplates.preview.empty")}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      <AssetPickerModal
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onPick={handlePickAsset}
      />

      <TemplateHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TemplatePreviewModal
        open={previewState.open}
        onClose={closePreview}
        title={previewState.title}
        html={previewState.html}
      />
    </div>
  );
}
