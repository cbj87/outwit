"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAllPicks } from "@/hooks/useAllPicks";
import {
  EVENT_LABELS,
  EVENT_SCORES,
  ICKY_PICK_SCORES,
  getSurvivalPoints,
} from "@shared/lib/constants";
import { useTribeColors } from "@/hooks/useTribeColors";
import type { Castaway, CastawayEvent } from "@shared/types";

const PLACEMENT_LABELS: Record<string, string> = {
  first_boot: "First Boot",
  pre_merge: "Pre-Merge",
  jury: "Jury Member",
  "3rd": "3rd Place",
  runner_up: "Runner-Up",
  winner: "Sole Survivor",
};

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

type EventWithEpisode = CastawayEvent & {
  episodes: { episode_number: number } | null;
};

export default function CastawayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tribeColors = useTribeColors();

  const { data, isLoading } = useQuery({
    queryKey: ["castaway", id],
    queryFn: async () => {
      const supabase = createClient();
      const [castawayRes, eventsRes] = await Promise.all([
        supabase.from("castaways").select("*").eq("id", id).single(),
        supabase
          .from("castaway_events")
          .select("*, episodes(episode_number)")
          .eq("castaway_id", id)
          .order("episodes(episode_number)", { ascending: true }),
      ]);
      return {
        castaway: castawayRes.data as Castaway,
        events: (eventsRes.data ?? []) as EventWithEpisode[],
      };
    },
    enabled: !!id,
  });

  const { castawayPickMap, revealed } = useAllPicks();

  if (isLoading || !data) {
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

  const { castaway, events } = data;
  const tribeColor =
    tribeColors[castaway.original_tribe] ?? tribeColors[castaway.current_tribe] ?? "#8E8E93";
  const currentTribeColor = tribeColors[castaway.current_tribe] ?? tribeColor;
  const pickData = castawayPickMap?.get(Number(id));

  const trioTotal = events.reduce((sum, event) => {
    if (event.event_type === "survived_episode") {
      return sum + getSurvivalPoints(event.episodes?.episode_number ?? 0);
    }
    return sum + (EVENT_SCORES[event.event_type] ?? 0);
  }, 0);

  const ickyTotal = castaway.final_placement
    ? (ICKY_PICK_SCORES[castaway.final_placement] ?? 0)
    : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div
        className="rounded-xl p-6 text-center border-b-4"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottomColor: tribeColor,
        }}
      >
        <div
          className="inline-block px-3 py-1 rounded text-xs font-black tracking-widest text-white mb-3"
          style={{ backgroundColor: currentTribeColor }}
        >
          {castaway.current_tribe}
        </div>
        <h1
          className="text-3xl font-black mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {castaway.name}
        </h1>
        <div
          className="text-sm font-semibold"
          style={{
            color: castaway.is_active
              ? "var(--color-success)"
              : "var(--color-error)",
          }}
        >
          {castaway.is_active
            ? "Active"
            : castaway.final_placement
            ? (PLACEMENT_LABELS[castaway.final_placement] ?? castaway.final_placement)
            : "Eliminated"}
        </div>
        {castaway.boot_order && (
          <div
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Eliminated: Episode {castaway.boot_order}
          </div>
        )}
      </div>

      {/* Picked By */}
      {revealed && pickData && (pickData.trio.length > 0 || pickData.icky.length > 0) && (
        <div>
          <h2
            className="text-xs font-bold tracking-widest uppercase mb-2 px-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Picked By
          </h2>
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              border: "1px solid var(--color-border)",
            }}
          >
            {pickData.trio.map((player) => {
              const initials = player.display_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={`trio-${player.player_id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold border-2"
                    style={{
                      borderColor: "var(--color-success)",
                      backgroundColor: player.avatar_url
                        ? "transparent"
                        : getAvatarColor(player.display_name),
                    }}
                  >
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.display_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <span
                    className="flex-1 text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {player.display_name}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: "rgba(52,199,89,0.12)",
                      color: "var(--color-success)",
                    }}
                  >
                    Trusted Trio
                  </span>
                </div>
              );
            })}
            {pickData.icky.map((player) => {
              const initials = player.display_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={`icky-${player.player_id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold border-2"
                    style={{
                      borderColor: "var(--color-error)",
                      backgroundColor: player.avatar_url
                        ? "transparent"
                        : getAvatarColor(player.display_name),
                    }}
                  >
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.display_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <span
                    className="flex-1 text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {player.display_name}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: "rgba(255,59,48,0.1)",
                      color: "var(--color-error)",
                    }}
                  >
                    Icky Pick
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trusted Trio Score */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Trusted Trio Score
          </h2>
          <span
            className="text-sm font-bold"
            style={{
              color:
                trioTotal > 0
                  ? "var(--color-success)"
                  : trioTotal < 0
                  ? "var(--color-error)"
                  : "var(--color-text-secondary)",
            }}
          >
            {trioTotal > 0 ? `+${trioTotal}` : trioTotal} pts
          </span>
        </div>
        <div
          className="rounded-xl p-4 space-y-1"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
            Points earned from events + survival if this castaway is in your Trusted Trio.
          </p>
          {events.length === 0 ? (
            <p
              className="text-sm italic py-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              No events logged yet.
            </p>
          ) : (
            events.map((event) => {
              const pts =
                event.event_type === "survived_episode"
                  ? getSurvivalPoints(event.episodes?.episode_number ?? 0)
                  : (EVENT_SCORES[event.event_type] ?? 0);
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-2 border-t first:border-t-0"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span
                    className="text-xs font-semibold w-10 flex-shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Ep {event.episodes?.episode_number ?? "?"}
                  </span>
                  <span
                    className="flex-1 text-sm"
                    style={{ color: "var(--color-text)" }}
                  >
                    {EVENT_LABELS[event.event_type] ?? event.event_type}
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{
                      color:
                        pts > 0
                          ? "var(--color-success)"
                          : pts < 0
                          ? "var(--color-error)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {pts > 0 ? `+${pts}` : pts}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Icky Pick Score */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Icky Pick Score
          </h2>
          <span
            className="text-sm font-bold"
            style={{
              color:
                ickyTotal > 0
                  ? "var(--color-success)"
                  : ickyTotal < 0
                  ? "var(--color-error)"
                  : "var(--color-text-secondary)",
            }}
          >
            {ickyTotal > 0 ? `+${ickyTotal}` : ickyTotal} pts
          </span>
        </div>
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
            Points based on final placement only — no event or survival points apply.
          </p>
          {castaway.final_placement ? (
            <div className="flex items-center justify-between py-2">
              <span className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                {PLACEMENT_LABELS[castaway.final_placement] ?? castaway.final_placement}
              </span>
              <span
                className="text-lg font-black"
                style={{
                  color:
                    ickyTotal > 0
                      ? "var(--color-success)"
                      : ickyTotal < 0
                      ? "var(--color-error)"
                      : "var(--color-text-secondary)",
                }}
              >
                {ickyTotal > 0 ? `+${ickyTotal}` : ickyTotal}
              </span>
            </div>
          ) : (
            <p
              className="text-sm italic py-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              {castaway.is_active
                ? "Still active — no Icky points awarded yet."
                : "Placement not set."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
