import axios from "axios";

const PRIMARY_API_URL =
  import.meta.env.VITE_API_URL ??
  "https://fleetmanagement-dq9t.onrender.com";

const FAILOVER_API_URL =
  "https://filscore-ai.quantech.international";

export const DEFAULT_API_BASE_URL = PRIMARY_API_URL;

export const api = axios.create({
  baseURL: PRIMARY_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  console.log(
    "API Request:",
    config.method?.toUpperCase(),
    `${config.baseURL}${config.url}`
  );

  return config;
});

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    console.error("Primary API Error:", error);

    // Prevent an infinite retry loop
    if (originalRequest?._failoverTried) {
      return Promise.reject(error);
    }

    // Only fail over when the primary server is unavailable
    const shouldFailover =
      error.code === "ECONNABORTED" ||
      error.code === "ERR_NETWORK" ||
      error.message?.toLowerCase().includes("timeout") ||
      [502, 503, 504].includes(error.response?.status);

    if (!shouldFailover || !originalRequest) {
      return Promise.reject(error);
    }

    console.warn(
      "Render unavailable. Switching API request to Contabo:",
      FAILOVER_API_URL
    );

    originalRequest._failoverTried = true;
    originalRequest.baseURL = FAILOVER_API_URL;

    return api.request(originalRequest);
  }
);