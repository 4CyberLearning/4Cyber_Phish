// frontend/src/api/users.js
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

export function listUsers() {
  return request("/api/users");
}

export function createUser(payload) {
  return request("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(id, payload) {
  return request(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id) {
  return request(`/api/users/${id}`, {
    method: "DELETE",
  });
}

export function listGroups() {
  return request("/api/groups");
}

export function createGroup(payload) {
  return request("/api/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateGroup(id, payload) {
  return request(`/api/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteGroup(id) {
  return request(`/api/groups/${id}`, {
    method: "DELETE",
  });
}

export function listGroupUsers(groupId, { take = 50, skip = 0, q = "" } = {}) {
  const params = new URLSearchParams();
  params.set("take", String(take));
  params.set("skip", String(skip));
  if (q) params.set("q", q);
  return request(`/api/groups/${groupId}/users?${params.toString()}`);
}

export function importUsersToGroup(groupId, users) {
  return request(`/api/users/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, users }),
  });
}