"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth";
import { SparklesBackground } from "@/components/ui/sparkles-bg";
import { FlipWords } from "@/components/ui/flip-words";
import { TextGenerateEffect } from "@/components/ui/text-generate";
import { StatefulButton } from "@/components/ui/stateful-button";
import { cn } from "@/lib/utils";

const words = ["платежи", "аренду", "подписки", "серверы", "обязательства"];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Неверный логин или пароль");
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-[#05050a] text-white overflow-hidden relative">
      <SparklesBackground />

      {/* Gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Left — branding */}
        <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Система активна
            </div>

            <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Не забывай
              <br />
              про{" "}
              <FlipWords words={words} className="text-blue-400" />
            </h1>

            <TextGenerateEffect
              words="Личное дело регулярных платежей. Напоминания в Telegram. Полный контроль расходов."
              className="text-lg text-gray-400 font-normal max-w-md"
            />

            <div className="mt-12 flex gap-8 text-sm text-gray-500">
              <div>
                <div className="text-2xl font-bold text-white">3</div>
                <div>валюты</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">24/7</div>
                <div>контроль</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">TG</div>
                <div>напоминания</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="w-full max-w-md"
          >
            <div className="relative">
              <div className="absolute -inset-[1px] bg-gradient-to-b from-blue-500/40 via-violet-500/20 to-transparent rounded-3xl blur-sm" />

              <div className="relative bg-[#0c0c14]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 sm:p-10">
                <div className="mb-8 lg:hidden text-center">
                  <h2 className="text-2xl font-bold">Invoice Keeper</h2>
                  <p className="text-gray-500 text-sm mt-1">Личное дело</p>
                </div>

                <div className="hidden lg:block mb-8">
                  <h2 className="text-2xl font-semibold">Вход в систему</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Введите данные учётной записи
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Логин
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3.5 rounded-2xl",
                        "bg-white/[0.03] border border-white/10",
                        "text-white placeholder-gray-600",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40",
                        "transition-all duration-200"
                      )}
                      placeholder="admin"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      className={cn(
                        "w-full px-4 py-3.5 rounded-2xl",
                        "bg-white/[0.03] border border-white/10",
                        "text-white placeholder-gray-600",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40",
                        "transition-all duration-200"
                      )}
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                    >
                      {error}
                    </motion.div>
                  )}

                  <StatefulButton
                    onClick={handleSubmit}
                    className="w-full py-3.5 rounded-2xl"
                  >
                    Войти в личное дело
                  </StatefulButton>
                </div>

                <p className="text-center text-xs text-gray-600 mt-8">
                  admin · admin123
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
