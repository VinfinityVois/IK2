"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function SettingsPage() {
  const { fetchMe } = useAuthStore();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    locale: "ru",
    current_password: "",
    new_password: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/profile").then(({ data }) => {
      setForm((f) => ({
        ...f,
        full_name: data.full_name || "",
        phone: data.phone || "",
        email: data.email || "",
        locale: data.locale || "ru",
      }));
    }).catch(console.error);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const payload: any = {
        full_name: form.full_name,
        phone: form.phone,
        locale: form.locale,
      };
      if (form.email) payload.email = form.email;
      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      } else if (form.email) {
        payload.current_password = form.current_password;
      }
      await api.patch("/profile", payload);
      setMsg("Сохранено");
      setForm((f) => ({ ...f, current_password: "", new_password: "" }));
      fetchMe();
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-lg bg-[#111] border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50";

  return (
    <div className="px-6 py-8 max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Настройки профиля</h1>
      <form onSubmit={save} className="space-y-4 rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-6">
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">ФИО</label>
          <input className={field + " mt-1"} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Телефон</label>
          <input className={field + " mt-1"} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7..." />
        </div>
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Email</label>
          <input type="email" className={field + " mt-1"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Язык</label>
          <select className={field + " mt-1"} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <p className="text-xs text-neutral-500">
          Смена email или пароля требует текущий пароль
        </p>
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Текущий пароль</label>
          <input type="password" className={field + " mt-1"} value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Новый пароль</label>
          <input type="password" className={field + " mt-1"} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="Заглавная, строчная, цифра, спецсимвол" />
        </div>
        {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
        {msg && <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>}
        <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
          {loading ? "…" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
