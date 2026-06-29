import axios from "axios";

export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  "https://fleetmanagement-dq9t.onrender.com";

export const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  console.log("API Request:", config.method, config.url);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);
    return Promise.reject(error);
  }
);
