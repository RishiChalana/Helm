import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getTokens, saveTokens, clearTokens } from "./auth";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const api: AxiosInstance = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const tokens = await getTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const tokens = await getTokens();
      const res = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: tokens?.refreshToken,
      });
      const { access_token, refresh_token } = res.data;
      await saveTokens(access_token, refresh_token);
      processQueue(null, access_token);
      original.headers.Authorization = `Bearer ${access_token}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      await clearTokens();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;

// Typed API helpers
export const authApi = {
  register: (email: string, password: string, full_name: string) =>
    api.post("/auth/register", { email, password, full_name }),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
  updatePushToken: (expo_push_token: string) =>
    api.patch("/auth/push-token", { expo_push_token }),
};

export const transactionApi = {
  list: (params?: Record<string, string>) => api.get("/transactions", { params }),
  create: (data: Record<string, unknown>) => api.post("/transactions", data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

export const budgetApi = {
  list: () => api.get("/budgets"),
  create: (data: Record<string, unknown>) => api.post("/budgets", data),
  status: (id: number) => api.get(`/budgets/${id}/status`),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/budgets/${id}`, data),
  delete: (id: number) => api.delete(`/budgets/${id}`),
};

export const agentApi = {
  chat: (message: string, conversation_id?: number) =>
    api.post("/agent/chat", { message, conversation_id }),
  conversations: () => api.get("/agent/conversations"),
};

export const reallocationApi = {
  execute: (proposal_id: string) => api.post("/reallocations/execute", { proposal_id }),
  undo: (audit_log_id: number) => api.post("/reallocations/undo", { audit_log_id }),
};

export const insightApi = {
  list: () => api.get("/insights"),
  markRead: (id: number) => api.patch(`/insights/${id}/read`),
};
