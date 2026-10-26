import axios from "axios";

// Static production and desktop builds always use the backend serving the page.
// Only the standalone Vite development server uses an explicit local API URL.
const api = axios.create({
  baseURL: window.desktop?.apiBaseURL || (import.meta.env.DEV
    ? import.meta.env.VITE_API_URL || "http://localhost:3000"
    : "/api"),
  timeout: 15000
});

export function errorMessage(error, fallback) {
  return error.response?.data?.message || error.response?.data?.error || fallback;
}

export default api;
