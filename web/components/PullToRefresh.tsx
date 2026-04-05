"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

// Raw finger movement needed to trigger a refresh
const PULL_THRESHOLD = 80;
// Max visual pull distance (dampened)
const MAX_VISUAL = 52;

export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [visual, setVisual] = useState(0); // px to translate the spinner down
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const rawPullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !refreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        rawPullRef.current = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        // Scrolling up — cancel tracking
        startYRef.current = null;
        rawPullRef.current = 0;
        setVisual(0);
        return;
      }
      // Prevent native scroll bounce while pulling
      if (delta > 8) e.preventDefault();
      rawPullRef.current = delta;
      // Dampen: sqrt curve so it feels natural and caps near MAX_VISUAL
      const dampened = Math.min(Math.sqrt(delta) * 4, MAX_VISUAL);
      setVisual(dampened);
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      const raw = rawPullRef.current;
      rawPullRef.current = 0;
      setVisual(0);

      if (raw >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        await queryClient.invalidateQueries();
        refreshingRef.current = false;
        setRefreshing(false);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [queryClient]);

  const visible = visual > 0 || refreshing;
  const translateY = refreshing ? MAX_VISUAL : visual;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 flex justify-center pointer-events-none z-50"
      style={{
        transform: `translateY(calc(${translateY}px - 44px))`,
        transition: visual === 0 ? "transform 0.25s ease" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="w-8 h-8 rounded-full border-[3px]"
        style={{
          borderColor: "var(--color-primary)",
          borderTopColor: "transparent",
          animation: refreshing ? "spin 0.7s linear infinite" : "none",
          opacity: refreshing ? 1 : Math.min(visual / (MAX_VISUAL * 0.6), 1),
        }}
      />
    </div>
  );
}
