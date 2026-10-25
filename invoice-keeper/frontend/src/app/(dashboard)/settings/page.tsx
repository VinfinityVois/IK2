"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Shield,
  User as UserIcon,
  Save,
  History,
  Building2,
  MessageCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { isAxiosError } from "axios";

type Profile = {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  locale: string;
  role: string;
};

type Tab = "profile" | "security" | "about";

const roleLabel = (role: string) => {
  if (role === "admin") return "Администратор";
  if (role === "user") return "Пользователь";
  return role;
};

const avatarKey = (userId: number) => `ik2_avatar_${userId}`;

export default function SettingsPage() {
  const { user, fetchMe } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState("ru");
  const [avatar, setAvatar] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [tgCode, setTgCode] = useState<string | null>(null);
  const [tgExpires, setTgExpires] = useState<number>(0);
  const [tgLoading, setTgLoading] = useState(false);

  const showMsg = (t: string) => {
    setMsg(t);
    setErr("");
    window.setTimeout(() => setMsg(""), 3200);
  };
  const showErr = (t: string) => {
    setErr(t);
    setMsg("");
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Profile>("/profile");
      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setLocale(data.locale || "ru");
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(avatarKey(data.id));
        setAvatar(stored);
      }
    } catch (e) {
      console.error(e);
      showErr("Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onPickAvatar = (file: File | null) => {
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) {
      showErr("Выберите изображение (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showErr("Файл больше 2 МБ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setAvatar(url);
      try {
        localStorage.setItem(avatarKey(profile.id), url);
        showMsg("Фото обновлено (сохранено в браузере)");
      } catch {
        showErr("Не удалось сохранить фото локально");
      }
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    if (!profile) return;
    setAvatar(null);
    localStorage.removeItem(avatarKey(profile.id));
    showMsg("Фото удалено");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const payload: Record<string, string> = {
        full_name: fullName,
        phone: phone,
        locale: locale,
      };
      const emailChanged = email !== (profile?.email || "");
      if (email) payload.email = email;
      if (emailChanged) {
        if (!currentPassword) {
          showErr("Для смены email укажите текущий пароль");
          setSaving(false);
          setTab("security");
          return;
        }
        payload.current_password = currentPassword;
      }
      const { data } = await api.patch<Profile>("/profile", payload);
      setProfile(data);
      setCurrentPassword("");
      showMsg("Профиль сохранён");
      await fetchMe();
    } catch (ex: unknown) {
      const detail = isAxiosError<{ detail?: string }>(ex)
        ? ex.response?.data?.detail
        : undefined;
      showErr(typeof detail === "string" ? detail : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    if (!currentPassword) {
      showErr("Укажите текущий пароль");
      setSaving(false);
      return;
    }
    if (newPassword.length < 8) {
      showErr("Новый пароль не короче 8 символов");
      setSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showErr("Пароли не совпадают");
      setSaving(false);
      return;
    }
    try {
      await api.patch("/profile", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showMsg("Пароль изменён");
    } catch (ex: unknown) {
      const detail = isAxiosError<{ detail?: string }>(ex)
        ? ex.response?.data?.detail
        : undefined;
      showErr(typeof detail === "string" ? detail : "Ошибка смены пароля");
    } finally {
      setSaving(false);
    }
  };

  const initials = (fullName || profile?.username || "?").slice(0, 2).toUpperCase();

  const inputCls =
    "w-full h-11 rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition";


  const requestTelegramCode = async () => {
    setTgLoading(true);
    try {
      const { data } = await api.post<{
        code: string;
        expires_in_seconds: number;
        instruction?: string;
      }>("/profile/telegram-link-code");
      setTgCode(data.code);
      setTgExpires(data.expires_in_seconds || 600);
      showMsg("Код создан — отправьте боту /link " + data.code);
    } catch (e: unknown) {
      if (isAxiosError<{ detail?: string }>(e)) {
        showErr(
          typeof e.response?.data?.detail === "string"
            ? e.response.data.detail
            : "Не удалось создать код"
        );
      } else {
        showErr("Не удалось создать код");
      }
    } finally {
      setTgLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-10 flex items-center justify-center text-neutral-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка профиля…
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-16">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Аккаунт · безопасность
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Настройки
          </h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            Профиль, контакты и смена пароля. Роль назначается администратором и не
            редактируется.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => showMsg("Журнал действий появится в следующей итерации")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#111] px-4 text-sm font-medium text-neutral-200 hover:bg-white/[0.06]"
          >
            <History className="h-4 w-4 text-neutral-400" />
            Журнал действий
          </button>
        </div>
      </header>

      {(msg || err) && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            err
              ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {err ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {err || msg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["profile", "Профиль", UserIcon],
            ["security", "Безопасность", Shield],
            ["about", "О системе", Building2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === id
                ? "bg-white text-black shadow"
                : "bg-[#111] text-neutral-400 hover:text-white border border-white/[0.06]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Аккаунт
          </p>
          <p className="mt-2 text-lg font-semibold text-white truncate">
            @{profile?.username}
          </p>
          <p className="mt-1 text-xs text-neutral-500">ID {profile?.id}</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Роль
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {roleLabel(profile?.role || user?.role || "user")}
          </p>
          <p className="mt-1 text-xs text-amber-200/80">Фиксирована · только чтение</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Безопасность
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              JWT
            </span>
          </div>
          <p className="mt-2 text-lg font-semibold text-white">Сессия активна</p>
          <p className="mt-1 text-xs text-neutral-500">Смена пароля в разделе «Безопасность»</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Локаль
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {locale === "en" ? "English" : "Русский"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Сохраняется в профиле</p>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main */}
        <div className="lg:col-span-8 space-y-6">
          {tab === "profile" && (
            <form
              onSubmit={saveProfile}
              className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6 space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-rose-400">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Личные данные</h2>
                  <p className="text-xs text-neutral-500">
                    ФИО, email, телефон · PATCH /profile
                  </p>
                </div>
              </div>

              {/* Avatar */}
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="relative">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center text-2xl font-bold text-white">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="Аватар" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-500"
                    title="Загрузить фото"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickAvatar(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-neutral-300">
                    Фото профиля (до 2 МБ). Пока хранится в браузере (localStorage) — в API
                    поля аватара нет.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.12]"
                    >
                      Выбрать файл
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-rose-300"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    ФИО
                  </label>
                  <input
                    className={inputCls}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    maxLength={255}
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </label>
                  <input
                    type="email"
                    className={inputCls}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.ru"
                  />
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Смена email требует текущий пароль (раздел «Безопасность» или поле ниже).
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <Phone className="h-3.5 w-3.5" />
                    Телефон
                  </label>
                  <input
                    className={inputCls}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 900 000-00-00"
                    maxLength={32}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Логин
                  </label>
                  <input
                    className={inputCls + " opacity-60 cursor-not-allowed"}
                    value={profile?.username || ""}
                    disabled
                    readOnly
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Роль
                  </label>
                  <input
                    className={inputCls + " opacity-60 cursor-not-allowed"}
                    value={roleLabel(profile?.role || "")}
                    disabled
                    readOnly
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Язык интерфейса
                  </label>
                  <select
                    className={inputCls}
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
                {email !== (profile?.email || "") && (
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
                      <Lock className="h-3.5 w-3.5" />
                      Текущий пароль (для смены email)
                    </label>
                    <input
                      type="password"
                      className={inputCls}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.35)] hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить профиль
                </button>
              </div>
            </form>
          )}

          {tab === "security" && (
            <form
              onSubmit={savePassword}
              className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6 space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-rose-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Смена пароля</h2>
                  <p className="text-xs text-neutral-500">
                    Требуется текущий пароль · политика сложности на бэкенде
                  </p>
                </div>
              </div>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Текущий пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showCur ? "text" : "password"}
                      className={inputCls + " pr-11"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                      onClick={() => setShowCur((v) => !v)}
                    >
                      {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Новый пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      className={inputCls + " pr-11"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Мин. 8 символов"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                      onClick={() => setShowNew((v) => !v)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Подтверждение
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-xs text-neutral-400 leading-relaxed">
                Пароль проверяется политикой сервера (длина, регистр, цифры/символы — см.{" "}
                <code className="text-neutral-300">password_policy</code>).
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(225,29,72,0.35)] hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Изменить пароль
                </button>
              </div>
            </form>
          )}

          {tab === "about" && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white">Invoice Keeper</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Система напоминаний о регулярных платежах. Корпоративные блоки из макета
                (ЭЦП, 1С, матрица доступов команды) — демонстрационный UI; рабочие данные
                профиля — через API <code className="text-neutral-300">/profile</code>.
              </p>
              <ul className="text-sm text-neutral-400 space-y-2 list-disc pl-5">
                <li>GET /profile — загрузка</li>
                <li>PATCH /profile — ФИО, телефон, email, locale, пароль</li>
                <li>Роль — только чтение (admin / user)</li>
                <li>Аватар — localStorage до появления поля на бэкенде</li>
              </ul>
            </div>
          )}
        </div>

        {/* Side */}
        <div className="lg:col-span-4 space-y-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Текущий профиль</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">ФИО</dt>
                <dd className="text-white text-right">{fullName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Email</dt>
                <dd className="text-white text-right truncate max-w-[60%]">
                  {email || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Телефон</dt>
                <dd className="text-white text-right">{phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Роль</dt>
                <dd className="text-amber-200 text-right">
                  {roleLabel(profile?.role || "")}
                </dd>
              </div>
            </dl>


          <article className="mt-6 rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#229ED9]" />
              <h2 className="text-sm font-semibold text-white">Telegram-бот</h2>
            </div>
            <p className="mb-4 text-xs text-neutral-500 leading-relaxed">
              Привяжите Telegram, чтобы получать напоминания об оплате и отмечать платежи
              кнопкой «Оплачено». Код действует 10 минут.
            </p>
            <button
              type="button"
              disabled={tgLoading}
              onClick={() => void requestTelegramCode()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#229ED9] px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {tgLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Получить код привязки
            </button>
            {tgCode && (
              <div className="mt-4 rounded-xl border border-[#229ED9]/30 bg-[#229ED9]/10 p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1">
                  Код (≈{Math.round(tgExpires / 60)} мин)
                </p>
                <p className="font-mono text-2xl font-bold tracking-widest text-white">
                  {tgCode}
                </p>
                <p className="mt-2 text-xs text-neutral-400">
                  В боте отправьте:{" "}
                  <code className="text-[#229ED9]">/link {tgCode}</code>
                </p>
              </div>
            )}
          </article>

        </article>

          <article className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
              <div className="text-xs text-neutral-400 leading-relaxed">
                <p className="text-sm font-medium text-white mb-1">Ограничения API</p>
                Смена email и пароля требует <strong className="text-neutral-300">текущий пароль</strong>.
                Роль меняется только администратором через /users.
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}