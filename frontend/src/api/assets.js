// frontend/src/api/assets.js
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  "";

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function uploadAsset(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(apiUrl("/api/assets"), {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      `Asset upload failed (${res.status} ${res.statusText || ""})`.trim();
    throw new Error(msg);
  }

  return data;
}

async function listAssets() {
  const res = await fetch(apiUrl("/api/assets"), {
    method: "GET",
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      `Assets load failed (${res.status} ${res.statusText || ""})`.trim();
    throw new Error(msg);
  }

  return Array.isArray(data) ? data : [];
}

async function deleteAsset(id) {
  const res = await fetch(apiUrl(`/api/assets/${id}`), {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => null);
    const msg =
      (data && data.error) ||
      `Asset delete failed (${res.status} ${res.statusText || ""})`.trim();
    throw new Error(msg);
  }
}

export { uploadAsset, listAssets, deleteAsset };
