"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { SparklesBackground } from "@/components/ui/sparkles-bg";
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token && !localStorage.getItem("access_token")) {
      router.push("/login");
      return;
    }
    fetchMe().then(() => {
      if (user && user.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      loadUsers();
    });
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/users", form);
      setForm({ username: "", password: "" });
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Ошибка создания");
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#05050a] text-white relative">
      <SparklesBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
            <p className="text-gray-500 mt-1">Управление доступом к личному делу</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
          >
            {showForm ? "Отмена" : "+ Добавить"}
          </button>
        </motion.div>

        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={createUser}
            className="mb-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                required
                placeholder="Логин"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <input
                required
                type="password"
                placeholder="Пароль"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              Создать пользователя
            </button>
          </motion.form>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] uppercase px-2 py-0.5 rounded-full border",
                      u.is_active
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : "border-red-500/30 text-red-400 bg-red-500/10"
                    )}
                  >
                    {u.is_active ? "active" : "inactive"}
                  </span>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-sm text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </motion.div>
            ))}
            {users.length === 0 && (
              <div className="text-center text-gray-500 py-16">
                Нет обычных пользователей
              </div>
            )}
          </div>
        )}

        <div className="mt-10">
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            ← Назад к платежам
          </a>
        </div>
      </div>
    </div>
  );
}
