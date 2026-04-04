"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { PageHeading } from "@/components/PageHeading";

export default function EpisodesPage() {
  const session = useAuthStore((s) => s.session);

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ["episodes-finalized"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("episodes")
        .select("id, episode_number, is_merge, is_finale")
        .eq("is_finalized", true)
        .order("episode_number", { ascending: true });
      return data ?? [];
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeading title="Episode Recaps" />

      {episodes.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
          No episodes have been finalized yet.
        </p>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          {episodes.map((ep, i) => (
            <Link
              key={ep.id}
              href={`/episodes/${ep.id}`}
              className="flex items-center justify-between px-4 py-3.5 hover:opacity-75 transition-opacity border-t first:border-t-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Episode {ep.episode_number}
                </span>
                {ep.is_merge && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(196,64,47,0.12)", color: "var(--color-primary)" }}
                  >
                    Merge
                  </span>
                )}
                {ep.is_finale && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(212,160,23,0.15)", color: "#D4A017" }}
                  >
                    Finale
                  </span>
                )}
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--color-text-muted)" }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
