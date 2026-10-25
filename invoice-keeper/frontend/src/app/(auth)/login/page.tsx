"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { register as apiRegister } from "@/lib/api";
import { TopographyBackground } from "@/components/ui/topography-bg";
import { FlipWords } from "@/components/ui/flip-words";
import { cn } from "@/lib/utils";

const words = ["платежи", "аренду", "подписки", "серверы"];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      sessionStorage.setItem("ik_welcome", "1");
      router.push("/overview");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      fail(
        detail === "User is inactive"
          ? "Аккаунт отключён"
          : "Неверный логин или пароль"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    setLoading(true);
    try {
      await apiRegister(username, email, password);
      await login(username, password);
      sessionStorage.setItem("ik_welcome", "1");
      router.push("/overview");
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      fail(
        typeof d === "string"
          ? d
          : Array.isArray(d)
          ? d.map((x: any) => x.msg).join(", ")
          : "Ошибка регистрации"
      );
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-neutral-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all";

  return (
    <div className="min-h-screen text-white overflow-hidden relative">
      <TopographyBackground
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#171717_0%,#000_100%)] text-blue-500/40"
        levels={16}
        speed={1}
        scale={1}
        peak={1}
        interactive
      />

      {/* SVG decor */}
      <svg className="absolute top-0 right-0 w-[480px] h-[480px] opacity-[0.07] pointer-events-none z-[1]" viewBox="0 0 400 400">
        <circle cx="320" cy="80" r="120" fill="none" stroke="#3b82f6" strokeWidth="1" />
        <circle cx="320" cy="80" r="80" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
        <path d="M200 200 L320 80" stroke="#3b82f6" strokeWidth="0.5" />
        <rect x="40" y="260" width="100" height="70" rx="8" fill="none" stroke="#fff" strokeWidth="0.5" />
        <rect x="55" y="245" width="40" height="12" rx="3" fill="#3b82f6" opacity="0.5" />
      </svg>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-neutral-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Защищённый вход · JWT
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1] mb-6">
              Контроль
              <br />
              <FlipWords words={words} className="text-blue-400" />
            </h1>
            <p className="text-neutral-500 max-w-md text-sm leading-relaxed">
              Личное дело регулярных платежей. Хеширование паролей (bcrypt),
              JWT-сессии, разделение ролей admin / user.
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-12">
          <motion.div
            animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="relative bg-[#0c0c0c]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
              {/* Tabs */}
              <div className="flex rounded-lg border border-white/10 p-0.5 mb-6">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError("");
                    }}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm transition-all",
                      mode === m
                        ? "bg-white text-black font-medium"
                        : "text-neutral-500 hover:text-white"
                    )}
                  >
                    {m === "login" ? "Вход" : "Регистрация"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">
                      Логин
                    </label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={field}
                      placeholder="username"
                      autoFocus
                    />
                  </div>

                  {mode === "register" && (
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={field}
                        placeholder="you@example.com"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (mode === "login" ? handleLogin() : handleRegister())
                      }
                      className={field}
                      placeholder={mode === "register" ? "мин. 8 символов" : "••••••••"}
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5"
                    >
                      <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </svg>
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    disabled={loading}
                    onClick={mode === "login" ? handleLogin : handleRegister}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {loading
                      ? "…"
                      : mode === "login"
                      ? "Войти"
                      : "Создать аккаунт"}
                  </button>
                </motion.div>
              </AnimatePresence>

              <p className="text-center text-[11px] text-neutral-600 mt-6">
                {mode === "login"
                  ? "admin / admin123 · или свой аккаунт"
                  : "Пароль хешируется bcrypt · JWT после входа"}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
