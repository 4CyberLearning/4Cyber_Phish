// src/api/assets.js
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// upload souboru přes FormData (bez credentials, bez ručního Content-Type)
export async function uploadAsset(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/assets`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Failed to upload asset";
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // ignoruj parse chybu
    }
    throw new Error(message);
  }

  return res.json(); // očekáváme { id, url, ... }
}
