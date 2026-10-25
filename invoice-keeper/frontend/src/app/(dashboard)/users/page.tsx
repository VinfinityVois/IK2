"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  History,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

interface UserItem {
  id: number;
  username: string;
  email?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

type RoleFilter = "all" | "active" | "inactive";

const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "?";

const avatarColor = (id: number) => {
  const colors = [
    "from-rose-600 to-rose-800",
    "from-indigo-600 to-indigo-800",
    "from-amber-500 to-amber-700",
    "from-teal-600 to-teal-800",
    "from-violet-600 to-violet-800",
    "from-sky-600 to-sky-800",
  ];
  return colors[id % colors.length];
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function UsersPage() {
  const router = useRouter();
  const { user, token, fetchMe } = useAuthStore();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const showOk = (msg: string) => {
    setOk(msg);
    setError("");
    window.setTimeout(() => setOk(""), 2800);
  };
  const showErr = (msg: string) => {
    setError(msg);
    setOk("");
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserItem[]>("/users");
      setUsers(data || []);
    } catch (err: unknown) {
      console.error(err);
      showErr("Не удалось загрузить пользователей");
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
    const init = async () => {
      try {
        await fetchMe();
        if (!cancelled) await loadUsers();
      } catch {
        if (!cancelled) router.replace("/login");
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [token, fetchMe, router, loadUsers]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/overview");
    }
  }, [user, router]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter === "active") list = list.filter((u) => u.is_active);
    if (roleFilter === "inactive") list = list.filter((u) => !u.is_active);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          String(u.id).includes(q)
      );
    }
    return list;
  }, [users, query, roleFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const inactive = users.length - active;
    return { total: users.length, active, inactive };
  }, [users]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const payload: { username: string; password: string; email?: string } = {
        username: form.username.trim(),
        password: form.password,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      await api.post("/users", payload);
      setForm({ username: "", password: "", email: "" });
      setModal(false);
      showOk("Пользователь создан");
      await loadUsers();
    } catch (err: unknown) {
      if (isAxiosError<{ detail?: string }>(err)) {
        showErr(
          typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Ошибка создания"
        );
      } else {
        showErr("Ошибка создания");
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (u: UserItem) => {
    setBusyId(u.id);
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
      showOk(u.is_active ? "Пользователь деактивирован" : "Пользователь активирован");
      await loadUsers();
    } catch (err: unknown) {
      if (isAxiosError<{ detail?: string }>(err)) {
        showErr(
          typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Ошибка обновления"
        );
      } else {
        showErr("Ошибка обновления");
      }
    } finally {
      setBusyId(null);
    }
  };

  const exportList = () => {
    const lines = [
      "Пользователи Invoice Keeper",
      `Экспорт: ${new Date().toLocaleString("ru-RU")}`,
      "",
      "id;username;email;role;is_active;created_at",
      ...users.map(
        (u) =>
          `${u.id};${u.username};${u.email || ""};${u.role};${u.is_active};${u.created_at}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showOk("CSV скачан");
  };

  if (user && user.role !== "admin") {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-16">
      {(ok || error) && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {error || ok}
        </div>
      )}

      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Администрирование · доступ
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Пользователи и команда
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Список пользователей из БД (роль user). Создание и активация — через API /users.
            Расширенные роли ЭЦП из макета в системе не хранятся.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => showOk("Журнал сессий — в следующей итерации")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 hover:bg-white/[0.06]"
          >
            <History className="h-4 w-4 text-neutral-400" />
            Журнал сессий
          </button>
          <button
            type="button"
            onClick={exportList}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 hover:bg-white/[0.06]"
          >
            <Download className="h-4 w-4 text-neutral-400" />
            Экспорт CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setModal(true);
              setError("");
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.35)] hover:brightness-110"
          >
            <UserPlus className="h-4 w-4" />
            Пригласить сотрудника
          </button>
        </div>
      </header>

      {/* KPI */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Всего в системе
            </span>
            <Users className="h-4 w-4 text-neutral-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {loading ? "…" : stats.total}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            роль user · API GET /users
          </p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Активны
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            {loading ? "…" : stats.active}
          </p>
          <p className="mt-1 text-xs text-neutral-500">is_active = true</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Неактивны
            </span>
            <span className="h-2 w-2 rounded-full bg-neutral-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-neutral-300">
            {loading ? "…" : stats.inactive}
          </p>
          <p className="mt-1 text-xs text-neutral-500">доступ отключён</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Ваша роль
            </span>
            <Shield className="h-4 w-4 text-amber-300" />
          </div>
          <p className="mt-2 text-xl font-bold text-white">Администратор</p>
          <p className="mt-1 text-xs text-neutral-500">
            @{user?.username} · только admin видит эту страницу
          </p>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          {/* Filters */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] pl-10 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-rose-500/40 focus:outline-none"
                  placeholder="Поиск по имени, email, id…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-4 text-sm text-neutral-300 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Обновить
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["all", `Все (${stats.total})`],
                  ["active", `Активны (${stats.active})`],
                  ["inactive", `На паузе (${stats.inactive})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRoleFilter(id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    roleFilter === id
                      ? "bg-white text-black"
                      : "bg-white/[0.06] text-neutral-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3 font-semibold sm:pl-5">Сотрудник</th>
                    <th className="px-4 py-3 font-semibold">Роль</th>
                    <th className="px-4 py-3 font-semibold">Статус</th>
                    <th className="px-4 py-3 font-semibold">Создан</th>
                    <th className="px-4 py-3 pr-5 font-semibold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-500">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-500">
                        Пользователи не найдены
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 sm:pl-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-sm font-bold text-white ${avatarColor(u.id)}`}
                            >
                              {initials(u.username)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">
                                {u.username}
                              </p>
                              <p className="truncate text-xs text-neutral-500">
                                {u.email || `id ${u.id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-neutral-300">
                            {u.role === "admin" ? "Админ" : "Пользователь"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Активен
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                              Неактивен
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-neutral-400 whitespace-nowrap">
                          {fmtDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3.5 pr-5 text-right">
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => void toggleActive(u)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                          >
                            {busyId === u.id ? (
                              <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                            ) : u.is_active ? (
                              "Деактивировать"
                            ) : (
                              "Активировать"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-neutral-500">
              <span>
                Показано <strong className="text-neutral-300">{filtered.length}</strong> из{" "}
                <strong className="text-neutral-300">{stats.total}</strong>
              </span>
              <span className="hidden sm:inline">Данные только с role=user (см. API)</span>
            </div>
          </div>
        </div>

        {/* Side */}
        <div className="xl:col-span-4 space-y-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">Роли в системе</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="text-neutral-300">admin</span>
                <span className="text-xs text-neutral-500">полный доступ</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                <span className="text-neutral-300">user</span>
                <span className="text-xs font-semibold text-white">{stats.total} в списке</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
              Матрица ЭЦП / отделов из макета не реализована в БД — только username, email,
              role, is_active.
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Быстрые действия</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/[0.08]"
              >
                <Plus className="h-4 w-4" />
                Создать пользователя
              </button>
              <button
                type="button"
                onClick={exportList}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/[0.08]"
              >
                <Download className="h-4 w-4" />
                Выгрузить CSV
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs text-neutral-400 leading-relaxed">
            <p className="text-sm font-medium text-white mb-1">API</p>
            <ul className="list-disc pl-3.5 space-y-1">
              <li>GET /users — список (admin)</li>
              <li>POST /users — создание role=user</li>
              <li>PATCH /users/:id — is_active, username, password</li>
            </ul>
          </article>
        </div>
      </div>

      {/* Create modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Новый пользователь</h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Логин
                </label>
                <input
                  required
                  minLength={3}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 text-sm text-white focus:border-rose-500/40 focus:outline-none"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Email (опционально)
                </label>
                <input
                  type="email"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 text-sm text-white focus:border-rose-500/40 focus:outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Пароль
                </label>
                <input
                  required
                  type="password"
                  minLength={8}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 text-sm text-white focus:border-rose-500/40 focus:outline-none"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              {error && modal && (
                <p className="text-sm text-rose-300">{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="rounded-xl px-4 py-2.5 text-sm text-neutral-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}