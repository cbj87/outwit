"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useMyPicks } from "@/hooks/useMyPicks";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { useEpisodeSeenStatus } from "@/hooks/useEpisodeSeenStatus";
import { useCastawayMap } from "@/hooks/useCastaways";
import { useTribeColors } from "@/hooks/useTribeColors";
import { PageHeading } from "@/components/PageHeading";
import { PROPHECY_QUESTIONS } from "@shared/lib/constants";

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

function SectionHeader({ title, points }: { title: string; points: number }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <h2
        className="text-xs font-bold tracking-widest uppercase"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {title}
      </h2>
      <span
        className="text-sm font-bold"
        style={{
          color:
            points > 0
              ? "var(--color-success)"
              : points < 0
              ? "var(--color-error)"
              : "var(--color-text-secondary)",
        }}
      >
        {points} pts
      </span>
    </div>
  );
}

function CastawayCard({
  castawayId,
  points,
  isActive,
  isIcky,
  isSpoilerFiltered,
}: {
  castawayId: number;
  points: number | null;
  isActive: boolean;
  isIcky?: boolean;
  isSpoilerFiltered: boolean;
}) {
  const castawayMap = useCastawayMap();
  const tribeColors = useTribeColors();
  const castaway = castawayMap.get(castawayId);
  const tribeColor = tribeColors[castaway?.original_tribe ?? ""] ?? "#8E8E93";

  return (
    <Link
      href={`/castaways/${castawayId}`}
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:opacity-80 transition-opacity"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: `4px solid ${tribeColor}`,
      }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${!isActive && !isSpoilerFiltered ? "line-through opacity-60" : ""}`}
            style={{ color: "var(--color-text)" }}
          >
            {castaway?.name ?? "?"}
          </span>
          {!isActive && !isSpoilerFiltered && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                color: "var(--color-error)",
                backgroundColor: "rgba(255,59,48,0.1)",
              }}
            >
              OUT
            </span>
          )}
          {isIcky && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                color: "var(--color-error)",
                backgroundColor: "rgba(255,59,48,0.08)",
              }}
            >
              Icky Pick
            </span>
          )}
        </div>
        <div
          className="text-xs mt-0.5 font-semibold"
          style={{ color: tribeColor }}
        >
          {castaway?.original_tribe}
        </div>
      </div>
      {points !== null ? (
        <span
          className="text-sm font-bold"
          style={{
            color:
              points > 0
                ? "var(--color-success)"
                : points < 0
                ? "var(--color-error)"
                : "var(--color-text-secondary)",
          }}
        >
          {points > 0 ? `+${points}` : points} pts
        </span>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>—</span>
      )}
      <span className="text-lg" style={{ color: "var(--color-text-muted)" }}>
        ›
      </span>
    </Link>
  );
}

export default function MyPicksPage() {
  const profile = useAuthStore((s) => s.profile);
  const activeGroup = useAuthStore((s) => s.activeGroup);

  const { config, isPicksLocked } = useSeasonConfig();
  const { maxSeenEpisode, isLoading: seenLoading } = useEpisodeSeenStatus();

  const spoilerEnabled = profile?.spoiler_protection ?? true;
  const currentEpisode = config?.current_episode ?? 0;

  const { data, isLoading } = useMyPicks({
    spoilerEnabled,
    maxSeenEpisode: spoilerEnabled ? maxSeenEpisode : 0,
    currentEpisode,
  });

  const initials = (profile?.display_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading || seenLoading) {
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

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          No Group Selected
        </h2>
        <p
          className="text-sm text-center max-w-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Join or create a group to manage your picks.
        </p>
        <Link
          href="/groups/join"
          className="px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Join a Group
        </Link>
      </div>
    );
  }

  if (!data?.picks) {
    const deadline = config?.picks_deadline ? new Date(config.picks_deadline) : null;
    const deadlinePassed = deadline ? new Date() > deadline : false;

    return (
      <div className="flex flex-col items-center py-20 gap-4">
        {deadlinePassed ? (
          <>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              Picks Locked
            </h2>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              The submission deadline has passed.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              Submit Your Picks
            </h2>
            {deadline && (
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Deadline:{" "}
                {deadline.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <Link
              href="/picks/submit"
              className="px-6 py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Make My Picks
            </Link>
          </>
        )}
      </div>
    );
  }

  const {
    picks,
    prophecyAnswers,
    prophecyOutcomes,
    trioDetail,
    trioPoints,
    ickyPoints,
    prophecyPoints,
    totalPoints,
    isSpoilerFiltered,
  } = data;

  const trio = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3];
  const answersMap = new Map(prophecyAnswers.map((a) => [a.question_id, a.answer]));
  const outcomesMap = new Map(
    prophecyOutcomes
      .filter((o) => {
        if (isSpoilerFiltered && o.episode_number !== null) {
          return o.episode_number <= maxSeenEpisode;
        }
        return true;
      })
      .map((o) => [o.question_id, o.outcome])
  );
  const trioDetailMap = new Map(trioDetail.map((d) => [d.castaway_id, d.points_earned]));

  const hasUnseenEpisodes =
    spoilerEnabled && maxSeenEpisode < currentEpisode && currentEpisode > 0;

  return (
    <div className="space-y-6 pb-8">
      <PageHeading title="My Picks" />
      {/* Player header */}
      <div
        className="flex flex-col items-center py-6 rounded-xl"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-16 h-16 rounded-full object-cover mb-3"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3"
            style={{ backgroundColor: getAvatarColor(profile?.display_name ?? "?") }}
          >
            {initials}
          </div>
        )}
        <div className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          {profile?.display_name}
        </div>
        <div className="text-2xl font-black mt-1" style={{ color: "var(--color-primary)" }}>
          {totalPoints} pts
        </div>
      </div>

      {/* Score summary pills */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Trio", value: trioPoints },
          { label: "Icky", value: ickyPoints },
          { label: "Prophecy", value: prophecyPoints },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center py-3 rounded-xl"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="text-xl font-black"
              style={{
                color:
                  value < 0 ? "var(--color-error)" : "var(--color-text)",
              }}
            >
              {value}
            </span>
            <span className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Spoiler banner */}
      {hasUnseenEpisodes && (
        <div
          className="px-4 py-3 rounded-xl text-sm border"
          style={{
            backgroundColor: "rgba(196,64,47,0.06)",
            borderColor: "rgba(196,64,47,0.2)",
          }}
        >
          <span className="font-semibold" style={{ color: "var(--color-primary)" }}>
            Spoiler protection on
          </span>
          <span style={{ color: "var(--color-text-secondary)" }}>
            {" — showing scores through Episode "}
            {maxSeenEpisode > 0 ? maxSeenEpisode : "pre-season"}.
          </span>
        </div>
      )}

      {/* Edit picks button */}
      {!isPicksLocked && (
        <Link
          href="/picks/submit"
          className="block text-center py-3 rounded-xl text-sm font-bold border"
          style={{
            color: "var(--color-primary)",
            borderColor: "var(--color-primary)",
            backgroundColor: "rgba(196,64,47,0.06)",
          }}
        >
          Edit Picks
        </Link>
      )}

      {/* Trusted Trio */}
      <div>
        <SectionHeader title="Trusted Trio" points={trioPoints} />
        <div className="space-y-2">
          {trio.map((castawayId) => {
            const points = isSpoilerFiltered
              ? null
              : (trioDetailMap.get(castawayId) ?? 0);
            return (
              <CastawayCard
                key={castawayId}
                castawayId={castawayId}
                points={points}
                isActive={true}
                isSpoilerFiltered={isSpoilerFiltered}
              />
            );
          })}
        </div>
      </div>

      {/* Icky Pick */}
      <div>
        <SectionHeader title="Icky Pick" points={ickyPoints} />
        <CastawayCard
          castawayId={picks.icky_castaway}
          points={ickyPoints}
          isActive={true}
          isIcky
          isSpoilerFiltered={isSpoilerFiltered}
        />
      </div>

      {/* Prophecy Picks */}
      <div>
        <SectionHeader title="Prophecy Picks" points={prophecyPoints} />
        <div className="space-y-2">
          {PROPHECY_QUESTIONS.map((q) => {
            const answer = answersMap.get(q.id);
            const outcome = outcomesMap.get(q.id);
            const isResolved = outcome !== null && outcome !== undefined;
            const isCorrect = isResolved && answer === outcome;

            return (
              <div
                key={q.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{
                  backgroundColor: isResolved
                    ? isCorrect
                      ? "rgba(52,199,89,0.06)"
                      : "rgba(255,59,48,0.04)"
                    : "var(--color-surface)",
                  borderColor: isResolved
                    ? isCorrect
                      ? "rgba(52,199,89,0.3)"
                      : "rgba(255,59,48,0.2)"
                    : "var(--color-border)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${isResolved && !isCorrect ? "opacity-60" : ""}`}
                    style={{ color: "var(--color-text)" }}
                  >
                    {q.text}
                  </p>
                  {isResolved && (
                    <p
                      className="text-xs font-semibold mt-0.5"
                      style={{
                        color: isCorrect ? "var(--color-success)" : "var(--color-error)",
                      }}
                    >
                      {isCorrect ? `+${q.points}pt` : "+0pt"}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        answer === undefined
                          ? "rgba(142,142,147,0.1)"
                          : isResolved && !isCorrect
                          ? "rgba(142,142,147,0.1)"
                          : answer
                          ? "rgba(52,199,89,0.12)"
                          : "rgba(255,59,48,0.1)",
                      color:
                        answer === undefined
                          ? "var(--color-text-muted)"
                          : isResolved && !isCorrect
                          ? "var(--color-text-muted)"
                          : answer
                          ? "var(--color-success)"
                          : "var(--color-error)",
                    }}
                  >
                    {answer === undefined ? "—" : answer ? "YES" : "NO"}
                  </span>
                  {isResolved ? (
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: isCorrect ? "var(--color-success)" : "var(--color-error)",
                      }}
                    >
                      {isCorrect ? "✓" : "✗"}
                    </span>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {q.points}pt
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
