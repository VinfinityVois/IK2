import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// При 401 — разлогиниваем
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ===== Auth =====
export async function register(username: string, email: string, password: string) {
  const { data } = await api.post("/auth/register", { username, email, password });
  return data;
}

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // { access_token, token_type }
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

// ===== Recurring Payments =====
export async function getRecurringPayments() {
  const { data } = await api.get("/recurring-payments");
  return data;
}

export async function createRecurringPayment(payload: any) {
  const { data } = await api.post("/recurring-payments", payload);
  return data;
}

export async function deleteRecurringPayment(id: number) {
  await api.delete(`/recurring-payments/${id}`);
}

// ===== Payment Occurrences =====
export async function getPaymentOccurrences(params?: {
  is_paid?: boolean;
  is_overdue?: boolean;
}) {
  const { data } = await api.get("/payment-occurrences", { params });
  return data;
}

export async function updatePaymentOccurrence(
  id: number,
  payload: { is_paid?: boolean; paid_at?: string | null }
) {
  const { data } = await api.patch(`/payment-occurrences/${id}`, payload);
  return data;
}

// ===== Summary =====
export async function getPaymentsSummary() {
  const { data } = await api.get("/payments/summary");
  return data;
}
