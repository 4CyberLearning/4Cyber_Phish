// frontend/src/components/AssetPickerModal.jsx
import { useEffect, useMemo, useState } from "react";
import { listAssets, uploadAsset, deleteAsset } from "../api/assets";

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

/**
 * Modal pro výběr existujícího assetu (obrázku).
 * - default: jen výběr + kopírování (bez upload/delete)
 * - upload/delete lze volitelně povolit přes props
 */
export default function AssetPickerModal({
  open,
  onClose,
  onPick,
  allowUpload = false,
  allowDelete = false,
  showCopy = true,
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

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
    if (open) {
      setQuery("");
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const hay = `${a.fileName || ""} ${a.url || ""} ${a.mimeType || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assets, query]);

  if (!open) return null;

  async function onUploadClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      setBusy(true);
      setError(null);
      try {
        await uploadAsset(file);
        await reload();
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
    try {
      await deleteAsset(id);
      await reload();
    } catch (e) {
      setError(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-semibold">Knihovna obrázků</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Zavřít
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
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

            {allowUpload && (
              <button
                type="button"
                onClick={onUploadClick}
                disabled={busy}
                className="rounded-md border border-[var(--brand-strong)] px-3 py-1.5 text-xs font-medium text-[var(--brand-strong)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
              >
                Nahrát obrázek
              </button>
            )}

            {error && (
              <div className="ml-auto text-xs font-medium text-red-600">
                {error}
              </div>
            )}
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="text-xs text-gray-500">Načítám…</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-gray-500">Žádné obrázky.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map((a) => (
                  <div
                    key={a.id}
                    className="overflow-hidden rounded-lg border border-gray-200"
                  >
                    <div className="aspect-video bg-gray-50">
                      <img
                        src={a.url}
                        alt={a.fileName || "asset"}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="p-2">
                      <div className="truncate text-[11px] text-gray-700">
                        {a.fileName}
                      </div>

                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onPick(a.url);
                            onClose();
                          }}
                          className="flex-1 rounded-md bg-[var(--brand-strong)] px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                        >
                          Vložit
                        </button>

                        {showCopy && (
                          <button
                            type="button"
                            onClick={() => safeCopy(a.url)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            URL
                          </button>
                        )}

                        {allowDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteClick(a.id)}
                            disabled={busy}
                            className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Smazat
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
