"use client";

import { useEffect } from "react";

const SELECTOR = ".rounded-2xl.border, [data-glow-card]";

/**
 * Подсветка границы карточек, следующая за курсором (как в окне входа).
 * Один слушатель на весь документ: страницы менять не нужно.
 * Карточка = .rounded-2xl.border или любой элемент с data-glow-card.
 */
export function CardGlow() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
        while (el) {
          if (!el.hasAttribute("data-glow")) {
            if (getComputedStyle(el).position === "static") el.style.position = "relative";
            el.setAttribute("data-glow", "");
          }
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - r.left}px`);
          el.style.setProperty("--my", `${e.clientY - r.top}px`);
          el = el.parentElement?.closest(SELECTOR) as HTMLElement | null;
        }
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
