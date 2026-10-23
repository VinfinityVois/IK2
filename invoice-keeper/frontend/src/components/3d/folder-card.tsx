"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  name: string;
  amount: string | number | null;
  currency: string | null;
  dueDate: string;
  isPaid: boolean;
  isOverdue: boolean;
  onTogglePaid: () => void;
  index?: number;
}

export function FolderCard({
  name,
  amount,
  currency,
  dueDate,
  isPaid,
  isOverdue,
  onTogglePaid,
  index = 0,
}: FolderCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };

  const formatMoney = () => {
    if (amount == null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
      className="relative"
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouse}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          x.set(0);
          y.set(0);
        }}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "relative rounded-2xl p-5 cursor-pointer transition-shadow duration-300",
          "bg-gradient-to-br from-[#0c0c0c] to-[#080808]",
          "border border-white/[0.06]",
          hovered && "shadow-2xl shadow-blue-500/10 border-white/10"
        )}
      >
        {/* Spotlight gradient */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
          style={{
            opacity: hovered ? 0.15 : 0,
            background: `radial-gradient(400px circle at ${
              (x.get() + 0.5) * 100
            }% ${(y.get() + 0.5) * 100}%, rgba(59,130,246,0.4), transparent 60%)`,
          }}
        />

        {/* Folder tab */}
        <div
          className="absolute -top-3 left-6 h-3 w-20 rounded-t-md"
          style={{
            background: isOverdue
              ? "linear-gradient(90deg, #ef4444, #f87171)"
              : isPaid
              ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
              : "linear-gradient(90deg, #3b82f6, #60a5fa)",
            transform: "translateZ(20px)",
          }}
        />

        <div style={{ transform: "translateZ(30px)" }} className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-white text-lg leading-tight">
                {name || "Без названия"}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Срок: {dueDate}</p>
            </div>

            <div className="flex flex-col items-end gap-1">
              {isOverdue && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                  Просрочено
                </span>
              )}
              {isPaid && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  Оплачено
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold tracking-tight text-white">
              {formatMoney()}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePaid();
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                isPaid
                  ? "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25"
              )}
            >
              {isPaid ? "Отменить" : "Оплачено"}
            </motion.button>
          </div>
        </div>

        {/* Bottom shine */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
    </motion.div>
  );
}
