"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** Floating button that appears after scrolling down and jumps back to the top. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cnVisible(visible)}
    >
      <ArrowUp size={20} />
    </button>
  );
}

function cnVisible(visible: boolean) {
  return [
    "fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full",
    "bg-brand-600 text-white shadow-pop transition-all duration-200 hover:bg-brand-700 active:bg-brand-800",
    "focus:outline-none focus:ring-2 focus:ring-brand-500/40",
    visible
      ? "translate-y-0 opacity-100"
      : "pointer-events-none translate-y-3 opacity-0",
  ].join(" ");
}
