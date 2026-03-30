"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useBioQuestions } from "@/hooks/useBioQuestions";
import { PageHeading } from "@/components/PageHeading";

const AVATAR_COLORS = [
  "#C4402F", "#2E7D32", "#1565C0", "#F57F17",
  "#7B1FA2", "#00838F", "#D84315", "#4527A0",
  "#00695C", "#AD1457", "#1B5E20", "#0D47A1",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface PlayerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  survivor_bio: Record<string, string> | null;
}

export default function PlayerGalleryPage() {
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { questions: bioQuestions, isLoading: questionsLoading } = useBioQuestions();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["player-gallery", activeGroup?.id],
    queryFn: async () => {
      if (!activeGroup?.id) return [];
      const supabase = createClient();
      const [membersResult, profilesResult] = await Promise.all([
        supabase.from("group_members").select("user_id").eq("group_id", activeGroup.id),
        supabase.from("profiles").select("id, display_name, avatar_url, survivor_bio"),
      ]);
      if (membersResult.error || profilesResult.error) return [];
      const memberIds = new Set((membersResult.data ?? []).map((m: any) => m.user_id));
      return (profilesResult.data as PlayerProfile[])
        .filter((p) => memberIds.has(p.id))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
    enabled: !!activeGroup?.id,
  });

  // Keyboard navigation for viewer
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (viewerIndex === null) return;
    if (e.key === "Escape") setViewerIndex(null);
    if (e.key === "ArrowRight") setViewerIndex((i) => i !== null ? Math.min(i + 1, players.length - 1) : null);
    if (e.key === "ArrowLeft") setViewerIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
  }, [viewerIndex, players.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = viewerIndex !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [viewerIndex]);

  if (isLoading || questionsLoading || playersLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const currentPlayer = viewerIndex !== null ? players[viewerIndex] : null;

  return (
    <>
      <div className="space-y-4 pb-8">
        <PageHeading title="Player Bios" />

        {players.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: "var(--color-text-muted)" }}>
            No players in your group yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {players.map((player, index) => {
              const initials = getInitials(player.display_name);
              const answeredCount = bioQuestions.filter(
                (q) => player.survivor_bio?.[q.key]?.trim()
              ).length;

              return (
                <button
                  key={player.id}
                  onClick={() => setViewerIndex(index)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:opacity-80 transition-opacity text-center"
                  style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.display_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-black"
                      style={{ backgroundColor: getAvatarColor(player.display_name) }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="text-sm font-semibold leading-tight w-full truncate" style={{ color: "var(--color-text)" }}>
                    {player.display_name}
                  </span>
                  {answeredCount > 0 && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {answeredCount} answered
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-screen viewer overlay */}
      {viewerIndex !== null && currentPlayer && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewerIndex(null); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
              {viewerIndex + 1} of {players.length}
            </span>
            <button
              onClick={() => setViewerIndex(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-base font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto px-6 py-6 flex flex-col items-center gap-5">
              {/* Avatar */}
              {currentPlayer.avatar_url ? (
                <img
                  src={currentPlayer.avatar_url}
                  alt={currentPlayer.display_name}
                  className="w-40 h-40 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-40 h-40 rounded-full flex items-center justify-center text-white text-5xl font-black"
                  style={{ backgroundColor: getAvatarColor(currentPlayer.display_name) }}
                >
                  {getInitials(currentPlayer.display_name)}
                </div>
              )}

              {/* Name */}
              <h2 className="text-3xl font-black text-white text-center">
                {currentPlayer.display_name}
              </h2>

              {/* Bio Q&A */}
              {(() => {
                const bio = currentPlayer.survivor_bio ?? {};
                const answered = bioQuestions.filter((q) => bio[q.key]?.trim());
                if (answered.length === 0) {
                  return (
                    <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.4)" }}>
                      No bio filled out yet.
                    </p>
                  );
                }
                return (
                  <div
                    className="w-full space-y-5 pt-5"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {answered.map((q) => (
                      <div key={q.key} className="space-y-1">
                        <div
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          {q.label}
                        </div>
                        <div className="text-base text-white leading-snug">
                          {bio[q.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between px-5 py-5 flex-shrink-0">
            <button
              onClick={() => setViewerIndex((i) => Math.max((i ?? 0) - 1, 0))}
              disabled={viewerIndex === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-30"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setViewerIndex((i) => Math.min((i ?? 0) + 1, players.length - 1))}
              disabled={viewerIndex === players.length - 1}
              className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-30"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
