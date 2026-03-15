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
  } catch (err) {
    console.error("Network error while calling API", err);
    throw new Error("Network error while calling API");
  }

  let data = null;
  try {
    if (res.status !== 204) {
      data = await res.json();
    }
  } catch {
    // ignore JSON parse error
  }

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      `API error ${res.status} ${res.statusText || ""}`.trim();
    throw new Error(msg);
  }

  return data;
}

export function listPackages() {
  return request("/api/packages");
}

export function getPackage(id) {
  return request(`/api/packages/${id}`);
}

export function createPackage(payload) {
  return request("/api/packages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePackage(id, payload) {
  return request(`/api/packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePackage(id) {
  return request(`/api/packages/${id}`, {
    method: "DELETE",
  });
}
