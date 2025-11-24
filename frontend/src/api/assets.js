// frontend/src/api/assets.js
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  "";

async function uploadAsset(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const url = API_BASE ? `${API_BASE}/api/assets` : "/api/assets";

    const res = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // nic
    }

    if (!res.ok) {
      const msg =
        (data && data.error) ||
        `Asset upload failed (${res.status} ${res.statusText || ""})`.trim();
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    console.error("Asset upload error", err);
    throw new Error("Image upload failed");
  }
}

export { uploadAsset };
