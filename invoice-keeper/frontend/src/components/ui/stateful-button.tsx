"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StatefulButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");

  const handle = async () => {
    if (state !== "idle" || disabled) return;
    setState("loading");
    try {
      await onClick?.();
      setState("success");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("idle");
    }
  };

  return (
    <motion.button
      whileHover={{ scale: state === "idle" ? 1.02 : 1 }}
      whileTap={{ scale: 0.98 }}
      onClick={handle}
      disabled={disabled || state !== "idle"}
      className={cn(
        "relative overflow-hidden px-6 py-3 rounded-xl font-medium text-white transition-all",
        "bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/25",
        "disabled:opacity-70",
        className
      )}
    >
      <motion.span
        animate={{ opacity: state === "idle" ? 1 : 0, y: state === "idle" ? 0 : -10 }}
        className="block"
      >
        {children}
      </motion.span>
      {state === "loading" && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </motion.span>
      )}
      {state === "success" && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center text-lg"
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}
