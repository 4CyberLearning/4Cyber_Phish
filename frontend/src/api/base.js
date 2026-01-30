export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  "";

export function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}
