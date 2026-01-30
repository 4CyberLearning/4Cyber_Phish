import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { listAssets, uploadAsset, deleteAsset } from "../../api/assets";

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

function safeCopy(text) {
  const v = String(text || "");
  if (!v) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(v).catch(() => {
      window.prompt("Copy to clipboard:", v);
    });
  } else {
    window.prompt("Copy to clipboard:", v);
  }
}

function AssetPreviewModal({ open, asset, onClose, onCopyUrl, onCopyImgTag, onDelete }) {
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

  if (!open || !asset) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/60" onClick={onClose}>
      <div className="h-full w-full overflow-y-auto p-4">
        <div
          className="mx-auto mt-10 w-full max-w-[1100px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold truncate">
                {asset.fileName || "Náhled obrázku"}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Zavřít
              </button>
            </div>

            <div className="bg-gray-50 p-4">
              <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2">
                <img
                  src={asset.url}
                  alt={asset.fileName || "asset"}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="mt-2 text-[11px] text-gray-500">
                {asset.mimeType ? `${asset.mimeType}` : ""}
                {asset.size ? ` · ${formatBytes(asset.size)}` : ""}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCopyUrl(asset.url)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Kopírovat URL
                </button>

                <button
                  type="button"
                  onClick={() => onCopyImgTag(asset.url)}
                  className="rounded-md border border-[var(--brand-strong)] px-2 py-1.5 text-[11px] font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                >
                  Kopírovat &lt;img&gt;
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(asset.id)}
                  className="col-span-2 rounded-md border border-red-300 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                >
                  Smazat
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AssetsPage() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAssets();
      setAssets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const hay = `${a.fileName || ""} ${a.url || ""} ${a.mimeType || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assets, query]);

  async function onUploadClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      setBusy(true);
      setError(null);
      setSuccess(null);
      try {
        await uploadAsset(file);
        await reload();
        setSuccess("Nahráno");
      } catch (e) {
        setError(e.message || "Upload failed");
      } finally {
        setBusy(false);
      }
    };

    input.click();
  }

  async function onDeleteClick(id) {
    if (!window.confirm("Smazat obrázek?")) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteAsset(id);
      await reload();
      setSuccess("Smazáno");
    } catch (e) {
      setError(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function copyImgTag(url) {
    const tag = `<img src="${url}" alt="" style="display:block; width:100%; height:auto; border:0;" />`;
    safeCopy(tag);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {t("nav.content.assets") || "Assety / soubory"}
            </h1>
            <p className="text-xs text-gray-500">
              Nahrané obrázky pro e-mailové šablony a landing pages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat… (název, URL, typ)"
              className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-strong)]"
            />
            <button
              type="button"
              onClick={reload}
              disabled={busy || loading}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Obnovit
            </button>
            <button
              type="button"
              onClick={onUploadClick}
              disabled={busy}
              className="rounded-md bg-[var(--brand-strong)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-soft-dark)] disabled:opacity-60"
            >
              Nahrát obrázek
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

      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-gray-500">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500">Žádné obrázky.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-lg border border-gray-200">
                <div
                  className="aspect-video bg-gray-50 cursor-zoom-in"
                  onClick={() => setPreviewAsset(a)}
                  title="Klikni pro náhled"
                >
                  <img
                    src={a.url}
                    alt={a.fileName || "asset"}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="p-3">
                  <div className="truncate text-xs font-medium text-gray-900">
                    {a.fileName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    {a.mimeType && <span>{a.mimeType}</span>}
                    {a.size ? <span>{formatBytes(a.size)}</span> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => safeCopy(a.url)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Kopírovat URL
                    </button>
                    <button
                      type="button"
                      onClick={() => copyImgTag(a.url)}
                      className="rounded-md border border-[var(--brand-strong)] px-2 py-1.5 text-[11px] font-semibold text-[var(--brand-strong)] hover:bg-[var(--brand-soft)]"
                    >
                      Kopírovat &lt;img&gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteClick(a.id)}
                      disabled={busy}
                      className="col-span-2 rounded-md border border-red-300 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AssetPreviewModal
        open={!!previewAsset}
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        onCopyUrl={(url) => safeCopy(url)}
        onCopyImgTag={(url) => copyImgTag(url)}
        onDelete={(id) => {
          setPreviewAsset(null);
          onDeleteClick(id);
        }}
      />
    </div>
  );
}
