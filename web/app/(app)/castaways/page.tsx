"use client";

import Link from "next/link";
import { useCastawaysByTribe } from "@/hooks/useCastaways";
import { useAllPicks } from "@/hooks/useAllPicks";
import { useTribeColors } from "@/hooks/useTribeColors";
import { PageHeading } from "@/components/PageHeading";
import type { Castaway } from "@shared/types";

function CastawayRow({ castaway, pickerCount, tribeColors }: { castaway: Castaway; pickerCount: { trio: number; icky: number } | null; tribeColors: Record<string, string> }) {
  const tribeColor = tribeColors[castaway.original_tribe] ?? "#8E8E93";

  return (
    <Link
      href={`/castaways/${castaway.id}`}
      className="flex items-center gap-3 px-4 py-3 border-t hover:opacity-80 transition-opacity first:border-t-0"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: tribeColor }}
      />
      <span
        className={`flex-1 text-sm font-semibold ${!castaway.is_active ? "line-through opacity-60" : ""}`}
        style={{ color: "var(--color-text)" }}
      >
        {castaway.name}
      </span>
      {!castaway.is_active && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ color: "var(--color-error)", backgroundColor: "rgba(255,59,48,0.1)" }}
        >
          OUT
        </span>
      )}
      {pickerCount !== null && (pickerCount.trio > 0 || pickerCount.icky > 0) && (
        <div className="flex gap-1.5 text-xs">
          {pickerCount.trio > 0 && (
            <span
              className="px-1.5 py-0.5 rounded font-semibold"
              style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "var(--color-success)" }}
            >
              {pickerCount.trio} trio
            </span>
          )}
          {pickerCount.icky > 0 && (
            <span
              className="px-1.5 py-0.5 rounded font-semibold"
              style={{ backgroundColor: "rgba(255,59,48,0.1)", color: "var(--color-error)" }}
            >
              {pickerCount.icky} icky
            </span>
          )}
        </div>
      )}
      <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>›</span>
    </Link>
  );
}

export default function CastawaysPage() {
  const { byTribe, isLoading } = useCastawaysByTribe();
  const { castawayPickMap, revealed } = useAllPicks();
  const tribeColors = useTribeColors();

  if (isLoading || !byTribe) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  const tribes = Object.keys(byTribe);

  return (
    <div className="space-y-6">
      <PageHeading title="Castaways" />

      {tribes.map((tribe) => {
        const castaways = byTribe[tribe] ?? [];
        const tribeColor = tribeColors[tribe] ?? "#8E8E93";
        const activeCount = castaways.filter((c) => c.is_active).length;

        return (
          <div key={tribe}>
            {/* Tribe header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 rounded-t-xl border-l-4 mb-0.5"
              style={{
                backgroundColor: tribeColor + "14",
                borderLeftColor: tribeColor,
                borderBottomColor: "var(--color-border)",
              }}
            >
              <span className="text-xs font-black tracking-widest" style={{ color: tribeColor }}>
                {tribe}
              </span>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {activeCount} active
              </span>
            </div>

            {/* Castaway rows */}
            <div
              className="rounded-b-xl overflow-hidden border"
              style={{ borderColor: "var(--color-border)" }}
            >
              {castaways.map((castaway) => {
                const picks = revealed ? castawayPickMap?.get(castaway.id) : null;
                const pickerCount = picks
                  ? { trio: picks.trio.length, icky: picks.icky.length }
                  : null;
                return (
                  <CastawayRow
                    key={castaway.id}
                    castaway={castaway}
                    pickerCount={pickerCount}
                    tribeColors={tribeColors}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {!revealed && (
        <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          Picks will be visible after the picks reveal.
        </p>
      )}
    </div>
  );
}
