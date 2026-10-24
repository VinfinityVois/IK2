"use client";

import { useEffect, useRef } from "react";

/** Упрощённый topography-фон (animate-ui style) для экрана входа */
export function TopographyBackground({
  className = "",
}: {
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      t += 0.008;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(59, 130, 246, 0.12)";
      ctx.lineWidth = 1;

      const levels = 18;
      for (let i = 0; i < levels; i++) {
        ctx.beginPath();
        const baseY = (h / levels) * i + Math.sin(t + i * 0.4) * 12;
        for (let x = 0; x <= w; x += 8) {
          const y =
            baseY +
            Math.sin(x * 0.008 + t + i) * (18 + i * 0.8) +
            Math.cos(x * 0.004 - t * 0.5) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // soft glow dots
      for (let i = 0; i < 40; i++) {
        const x = (Math.sin(t * 0.3 + i) * 0.5 + 0.5) * w;
        const y = (Math.cos(t * 0.2 + i * 1.3) * 0.5 + 0.5) * h;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 140, 255, ${0.15 + (i % 5) * 0.04})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
    />
  );
}
