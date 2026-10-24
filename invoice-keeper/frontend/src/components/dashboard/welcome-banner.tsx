"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function WelcomeBanner({
  username,
  role,
}: {
  username?: string;
  role?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("ik_welcome") === "1") {
      setShow(true);
      sessionStorage.removeItem("ik_welcome");
      const t = setTimeout(() => setShow(false), 4500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/25 bg-blue-500/10"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {(username?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">
              С возвращением, {username}
            </div>
            <div className="text-xs text-neutral-400">
              Роль: {role} · сессия защищена JWT
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="ml-auto text-neutral-500 hover:text-white"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
