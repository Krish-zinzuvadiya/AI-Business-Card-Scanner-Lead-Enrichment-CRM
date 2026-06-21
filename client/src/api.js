import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "/api";
export const ASSET_BASE = API_BASE.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || "Request failed";
    return Promise.reject(new Error(message));
  }
);

export default api;
