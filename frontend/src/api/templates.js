// src/api/templates.js
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// společná helper funkce na JSON requesty (bez credentials)
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = "Failed to fetch";
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // ignoruj parse chybu
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

export function listTemplates() {
  return request("/api/templates");
}

export function createTemplate(data) {
  return request("/api/templates", {
    method: "POST",
    body: data,
  });
}

export function updateTemplate(id, data) {
  return request(`/api/templates/${id}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteTemplate(id) {
  return request(`/api/templates/${id}`, {
    method: "DELETE",
  });
}

export function sendTemplateTest(id, to) {
  return request(`/api/templates/${id}/send-test`, {
    method: "POST",
    body: { to },
  });
}
