import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Выводим полезную информацию о запросе, если он завершился ошибкой.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const baseURL = error.config?.baseURL ?? "";
      const url = error.config?.url ?? "";
      const fullURL = `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;

      console.error("API request failed", {
        message: error.message,
        code: error.code ?? "NO_CODE",
        method: error.config?.method?.toUpperCase() ?? "UNKNOWN",
        fullURL,
        status: error.response?.status ?? "NO_HTTP_RESPONSE",
        responseData: error.response?.data ?? null,
      });

      if (
        error.response?.status === 401 &&
        typeof window !== "undefined"
      ) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    } else {
      console.error("Unexpected API error:", error);
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

export interface RecurringPaymentCreate {
  name: string;
  amount: number;
  currency: "RUB" | "USD" | "EUR";
  next_due_date: string;
  periodicity: "monthly";
  description: string | null;
}

export async function createRecurringPayment(
  payload: RecurringPaymentCreate
) {
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
  // Бэкенд отдаёт { items, total }; голый массив тоже принимаем — страницы читают .items
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  return { items, total: Array.isArray(data) ? items.length : (data?.total ?? items.length) };
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


export interface TelegramStatus {
  linked: boolean;
  telegram_id: number | null;
  has_pending_code: boolean;
  code_expires_at: string | null;
}

export interface TelegramLinkCode {
  code: string;
  expires_in_seconds: number;
  expires_at: string;
  instruction: string;
  user_id: number;
  username: string;
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const { data } = await api.get("/profile/telegram-status");
  return data;
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  const { data } = await api.post("/profile/telegram-link-code");
  return data;
}

export async function unlinkTelegram() {
  const { data } = await api.delete("/profile/telegram-link");
  return data;
}