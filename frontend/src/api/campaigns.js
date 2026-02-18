// frontend/src/api/campaigns.js
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  "";

const SENDING_ENABLED = import.meta.env.VITE_EMAIL_SENDING_ENABLED === "true";

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
  const isJson =
    res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (data && data.error) ||
      (typeof data === "string" ? data : "Request failed");
    throw new Error(message);
  }

  return data;
}

export function listCampaigns() {
  return request("/api/campaigns");
}

export function getCampaign(id) {
  return request(`/api/campaigns/${id}`);
}

export function createCampaign(payload) {
  return request("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendCampaignNow(id) {
  if (!SENDING_ENABLED) {
    return Promise.reject(new Error("Sending is disabled (VITE_EMAIL_SENDING_ENABLED != true)."));
  }

  return request(`/api/campaigns/${id}/send-now`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteCampaign(id) {
  return request(`/api/campaigns/${id}`, {
    method: "DELETE",
  });
}

export function updateCampaign(id, payload) {
  return request(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  });
}

export function sendCampaignTest() {
  return Promise.reject(new Error("sendCampaignTest is not implemented."));
}

export function setCampaignTargetsGroup(campaignId, groupId) {
  return request(`/api/campaigns/${campaignId}/targets/group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
}
