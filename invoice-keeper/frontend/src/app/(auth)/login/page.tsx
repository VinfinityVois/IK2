"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, User, type LucideIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { register as apiRegister } from "@/lib/api";
import { FlipWords } from "@/components/ui/flip-words";
import type { Pulse } from "@/components/ui/terrain-3d-bg";
import { cn } from "@/lib/utils";

const Terrain3DBackground = dynamic(() => import("@/components/ui/terrain-3d-bg"), { ssr: false });

const words = ["платежи", "аренду", "подписки", "серверы"];

function getErrorDetail(err: unknown): unknown {
  if (typeof err !== "object" || err === null || !("response" in err)) {
    return undefined;
  }

  const response = err.response;
  if (typeof response !== "object" || response === null || !("data" in response)) {
    return undefined;
  }

  const data = response.data;
  if (typeof data !== "object" || data === null || !("detail" in data)) {
    return undefined;
  }

  return data.detail;
}

function formatValidationErrors(value: unknown): string {
  if (!Array.isArray(value)) return "Ошибка регистрации";

  return value
    .map((item: unknown) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "msg" in item &&
        typeof item.msg === "string"
      ) {
        return item.msg;
      }
      return String(item);
    })
    .join(", ");
}


const input =
  "w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-neutral-600 outline-none transition focus:bg-white/[0.07] focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/15";

function Field({ id, label, icon: Icon, children }: { id: string; label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-neutral-400 mb-1.5">
        {label}
      </label>
      <div className="relative group">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const mode = "login" as "login" | "register"; // регистрации нет: пользователей создаёт администратор
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState<Pulse>(null);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setPulse({ id: Date.now(), tone: "error" });
    setTimeout(() => setShake(false), 500);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      if (mode === "register") await apiRegister(username, email, password);
      await login(username, password);
      setPulse({ id: Date.now(), tone: "success" });
      sessionStorage.setItem("ik_welcome", "1");
      setTimeout(() => router.push("/overview"), 450); // даём волне дойти
    } catch (err: unknown) {
      const detail = getErrorDetail(err);
      if (mode === "login") {
        fail(detail === "User is inactive" ? "Аккаунт отключён" : "Неверный логин или пароль");
      } else if (typeof detail === "string") {
        fail(detail);
      } else {
        fail(formatValidationErrors(detail));
      }
      setLoading(false);
    }
  };

  // подсветка границы карточки следует за курсором
  const track = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="min-h-screen text-white overflow-hidden relative">
      <Terrain3DBackground pulse={pulse} />
      {/* виньетка: текст и форма читаются поверх рельефа */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_35%,#050505_100%)]" />
      <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-r from-[#050505]/80 via-[#050505]/20 to-transparent" />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur text-xs text-neutral-300 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Защищённый вход · JWT
            </div>
            <h1 className="text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
              Контроль
              <br />
              <FlipWords words={words} className="text-blue-400" />
            </h1>
            <p className="text-neutral-400 max-w-md text-sm leading-relaxed">
              Личное дело регулярных платежей. Хеширование паролей (bcrypt), JWT-сессии, разделение ролей admin / user.
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={shake ? { opacity: 1, y: 0, x: [-8, 8, -6, 6, -3, 3, 0] } : { opacity: 1, y: 0, x: 0 }}
            transition={{ duration: shake ? 0.4 : 0.6 }}
            className="w-full max-w-md"
          >
            <div
              onMouseMove={track}
              className="rounded-2xl p-px shadow-[0_30px_80px_-20px_rgba(37,99,235,0.35)]"
              style={{
                background:
                  "radial-gradient(320px circle at var(--mx, 50%) var(--my, 0%), rgba(96,165,250,0.75), rgba(255,255,255,0.08) 65%)",
              }}
            >
              <div className="rounded-[15px] bg-[#08090d]/80 backdrop-blur-2xl p-8">
                <p className="text-xl font-semibold tracking-tight mb-1">Вход</p>
                <p className="text-xs text-neutral-500 mb-6">Учётные записи создаёт администратор</p>

                <form onSubmit={submit}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={mode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-4"
                    >
                      <Field id="username" label="Логин" icon={User}>
                        <input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className={input}
                          placeholder="username"
                          autoComplete="username"
                          autoFocus
                          required
                        />
                      </Field>

                      {mode === "register" && (
                        <Field id="email" label="Email" icon={Mail}>
                          <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={input}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                          />
                        </Field>
                      )}

                      <Field id="password" label="Пароль" icon={Lock}>
                        <input
                          id="password"
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={cn(input, "pr-12")}
                          placeholder={mode === "register" ? "мин. 8 символов" : "••••••••"}
                          autoComplete={mode === "register" ? "new-password" : "current-password"}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-500 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </Field>

                      {error && (
                        <motion.div
                          role="alert"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5"
                        >
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{error}</span>
                        </motion.div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full h-12 overflow-hidden rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70 outline-none focus-visible:ring-4 focus-visible:ring-blue-400/30"
                      >
                        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 blur-md transition-transform duration-700 group-hover:translate-x-[420%]" />
                        <span className="relative inline-flex items-center justify-center gap-2">
                          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                          {mode === "login" ? "Войти" : "Создать аккаунт"}
                        </span>
                      </button>
                    </motion.div>
                  </AnimatePresence>
                </form>

                <p className="text-center text-[11px] text-neutral-500 mt-6">
                  Пароль хешируется bcrypt · JWT-сессия
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}