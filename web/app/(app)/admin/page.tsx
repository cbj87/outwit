"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { createClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const router = useRouter();
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const { config, isLoading: configLoading } = useSeasonConfig();

  const [isCalcing, setIsCalcing] = useState(false);
  const [calcResult, setCalcResult] = useState<string | null>(null);

  if (isLoading || configLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!isCommissioner) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          Access Denied
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          This page is for commissioners only.
        </p>
      </div>
    );
  }

  async function handleCalculateScores() {
    setIsCalcing(true);
    setCalcResult(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Score calc failed (${res.status}): ${body}`);
      }
      setCalcResult("Scores recalculated successfully.");
    } catch (e: any) {
      setCalcResult(`Error: ${e.message}`);
    } finally {
      setIsCalcing(false);
    }
  }

  const adminLinks = [
    {
      href: "/admin/episode",
      label: "Log Episode Events",
      description: "Record votes, idols, immunity wins, and finalize episode scores.",
    },
    {
      href: "/admin/prophecy",
      label: "Prophecy Outcomes",
      description: "Resolve yes/no outcomes for the 16 pre-season prophecy questions.",
    },
    {
      href: "/admin/tribes",
      label: "Manage Tribes",
      description: "Reassign castaways between tribes and update tribe colors.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
          Commissioner Panel
        </h1>
        {config && (
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Current episode: {config.current_episode > 0 ? config.current_episode : "Pre-season"}
            {config.picks_revealed ? " · Picks revealed" : " · Picks hidden"}
          </p>
        )}
      </div>

      {/* Nav cards */}
      <div className="space-y-3">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between px-4 py-4 rounded-xl border hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                {link.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {link.description}
              </div>
            </div>
            <span style={{ color: "var(--color-text-muted)" }}>›</span>
          </Link>
        ))}
      </div>

      {/* Calculate Scores */}
      <div
        className="px-4 py-4 rounded-xl border space-y-3"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div>
          <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
            Recalculate All Scores
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Force a full score recalculation across all episodes and groups.
          </div>
        </div>
        <button
          onClick={handleCalculateScores}
          disabled={isCalcing}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {isCalcing ? "Calculating..." : "Calculate Scores"}
        </button>
        {calcResult && (
          <p
            className="text-xs"
            style={{
              color: calcResult.startsWith("Error")
                ? "var(--color-error)"
                : "var(--color-text-secondary)",
            }}
          >
            {calcResult}
          </p>
        )}
      </div>
    </div>
  );
}
