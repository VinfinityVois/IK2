
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { isAxiosError } from "axios";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UserItem {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { user, token, fetchMe } = useAuthStore();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const { data } = await api.get<UserItem[]>("/users");
      setUsers(data);
    } catch (err: unknown) {
      console.error("Ошибка загрузки пользователей:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token && !localStorage.getItem("access_token")) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      try {
        await fetchMe();

        if (!cancelled) {
          await loadUsers();
        }
      } catch (err: unknown) {
        console.error("Ошибка проверки авторизации:", err);

        if (!cancelled) {
          router.replace("/login");
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [token, fetchMe, router, loadUsers]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/users", form);

      setForm({ username: "", password: "" });
      setModal(false);
      setOk("Пользователь создан");
      setTimeout(() => setOk(""), 2500);

      await loadUsers();
    } catch (err: unknown) {
      if (isAxiosError<{ detail?: string }>(err)) {
        setError(err.response?.data?.detail || "Ошибка создания");
      } else {
        setError("Ошибка создания");
      }
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Удалить пользователя?")) return;

    try {
      await api.delete(`/users/${id}`);

      setOk("Удалён");
      setTimeout(() => setOk(""), 2000);

      await loadUsers();
    } catch (err: unknown) {
      console.error("Ошибка удаления пользователя:", err);

      if (isAxiosError<{ detail?: string }>(err)) {
        setError(err.response?.data?.detail || "Ошибка удаления пользователя");
      } else {
        setError("Ошибка удаления пользователя");
      }
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-lg bg-[#111] border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-blue-500/50";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-xl">
        <div className="px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-medium">Пользователи</h1>
          <button
            onClick={() => {
              setError("");
              setModal(true);
            }}
            className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
          >
            + Пользователь
          </button>
        </div>
      </header>

      <div className="px-6 py-6 max-w-[1000px]">
        {ok && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-sm">
            {ok}
          </div>
        )}

        {error && !modal && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-4 py-3 rounded-lg border border-white/[0.06] bg-[#0c0c0c] hover:border-white/10 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold">
                  {(u.username || "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{u.username}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </div>
                </div>

                <span
                  className={cn(
                    "text-[10px] uppercase px-2 py-0.5 rounded border",
                    u.is_active
                      ? "border-green-500/30 text-green-400 bg-green-500/10"
                      : "border-red-500/30 text-red-400 bg-red-500/10"
                  )}
                >
                  {u.is_active ? "active" : "off"}
                </span>

                <button
                  onClick={() => void deleteUser(u.id)}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                >
                  Удалить
                </button>
              </motion.div>
            ))}

            {users.length === 0 && (
              <div className="text-center text-neutral-600 py-16 text-sm">
                Нет пользователей
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(false)}
              className="absolute inset-0 bg-black/75"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-xl shadow-2xl z-10"
            >
              <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
                <h2 className="text-base font-medium">Новый пользователь</h2>
                <button
                  onClick={() => setModal(false)}
                  className="text-neutral-500 hover:text-white text-xl"
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={createUser}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                    Логин
                  </label>
                  <input
                    required
                    minLength={3}
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    className={field}
                    placeholder="user1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                    Пароль
                  </label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className={field}
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModal(false);
                      setError("");
                    }}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-neutral-400 text-sm"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
