"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { login as apiLogin, getMe } from "@/lib/api";

interface User {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setToken: (token) => {
        if (token) {
          localStorage.setItem("access_token", token);
        } else {
          localStorage.removeItem("access_token");
        }
        set({ token });
      },

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const data = await apiLogin(username, password);
          get().setToken(data.access_token);
          const user = await getMe();
          set({ user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null, token: null });
      },

      fetchMe: async () => {
        const token = get().token || localStorage.getItem("access_token");
        if (!token) return;
        try {
          const user = await getMe();
          set({ user, token });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    }
  )
);
