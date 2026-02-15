// frontend/src/api/recipientDomains.js
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  "";

async function request(path, options = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path;

  let res;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (e) {
    console.error("Network error", e);
    throw new Error("Network error");
  }

  if (res.status === 204) return null;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (data && data.error) || (typeof data === "string" ? data : "Request failed");
    throw new Error(message);
  }

  return data;
}

export function listRecipientDomains() {
  return request("/api/recipient-domains");
}

export function createRecipientDomain(payload) {
  return request("/api/recipient-domains", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export function updateRecipientDomain(id, payload) {
  return request(`/api/recipient-domains/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload || {}),
  });
}

export function deleteRecipientDomain(id) {
  return request(`/api/recipient-domains/${id}`, {
    method: "DELETE",
  });
}