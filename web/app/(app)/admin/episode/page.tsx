"use client";

import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useCastawaysByTribe } from "@/hooks/useCastaways";
import { useTribeColors } from "@/hooks/useTribeColors";
import type { Castaway, EventType } from "@shared/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FINALE_MILESTONES: EventType[] = [
  "fire_making_win",
  "final_immunity_win",
  "placed_3rd",
  "placed_runner_up",
  "sole_survivor",
];

const EVENT_LABELS: Record<string, string> = {
  fire_making_win: "Won Fire Making Challenge",
  final_immunity_win: "Won Final Immunity (F4)",
  placed_3rd: "3rd Place",
  placed_runner_up: "Runner-Up",
  sole_survivor: "Sole Survivor",
  made_jury: "Made Jury",
};

type IdolPlayResult = "correct" | "incorrect";
type ShotResult = "success" | "fail";

interface EpisodeRow {
  id: number;
  episode_number: number;
  is_finalized: boolean;
  is_merge: boolean;
  is_finale: boolean;
  created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EpisodeAdminPage() {
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();

  const { byTribe, castaways, isLoading: castawaysLoading } = useCastawaysByTribe();
  const tribeColors = useTribeColors();

  // Episode selection state
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState(0);
  const [pastEpisodes, setPastEpisodes] = useState<EpisodeRow[]>([]);
  const [episodesLoaded, setEpisodesLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<string | null>(null);

  // Episode flags
  const [isMerge, setIsMerge] = useState(false);
  const [isFinale, setIsFinale] = useState(false);
  const [showEpisodeOptions, setShowEpisodeOptions] = useState(false);

  // Category state
  const [votedOff, setVotedOff] = useState<Set<number>>(new Set());
  const [votedOffDetails, setVotedOffDetails] = useState<Record<number, Set<string>>>({});
  const [immunityWinners, setImmunityWinners] = useState<Set<number>>(new Set());
  const [rewardWinners, setRewardWinners] = useState<Set<number>>(new Set());
  const [idolsFound, setIdolsFound] = useState<Set<number>>(new Set());
  const [advantagesFound, setAdvantagesFound] = useState<Set<number>>(new Set());
  const [idolPlays, setIdolPlays] = useState<Record<number, IdolPlayResult>>({});
  const [shotInDark, setShotInDark] = useState<Record<number, ShotResult>>({});
  const [milestones, setMilestones] = useState<Record<string, Set<number>>>({});

  // Expanded card state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(["votedOff"]));

  // ── Fetch episodes on mount ────────────────────────────────────────────────

  useMemo(() => {
    if (episodesLoaded || isAuthLoading || !isCommissioner) return;
    const supabase = createClient();
    supabase
      .from("episodes")
      .select("id, episode_number, is_finalized, is_merge, is_finale, created_at")
      .order("episode_number", { ascending: true })
      .then(({ data }: { data: EpisodeRow[] | null }) => {
        setPastEpisodes(data ?? []);
        setEpisodesLoaded(true);
      });
  }, [episodesLoaded, isAuthLoading, isCommissioner]);

  // ── Castaway helpers ───────────────────────────────────────────────────────

  const activeCastaways = useMemo(
    () => (castaways ?? []).filter((c) => c.is_active),
    [castaways]
  );

  // IDs of castaways who were in the game at the START of this episode.
  // Derived by querying who had a survived_episode event in the most recent
  // finalized episode before this one. null = no prior episodes, show everyone.
  const [eligibleForVotedOff, setEligibleForVotedOff] = useState<Set<number> | null>(null);

  // For the "Voted Off" grid: show castaways who were in the game at the start
  // of this episode (survived the previous episode), or everyone if ep 1.
  const votedOffGridCastaways = useMemo(
    () => eligibleForVotedOff === null
      ? (castaways ?? [])
      : (castaways ?? []).filter((c) => eligibleForVotedOff.has(c.id)),
    [castaways, eligibleForVotedOff]
  );

  const remainingCastaways = useMemo(
    () => activeCastaways.filter((c) => !votedOff.has(c.id)),
    [activeCastaways, votedOff]
  );

  // Find who survived the most recent finalized episode before epNumber.
  // Those survivors are exactly the castaways eligible to be voted off in epNumber.
  // Returns null if there are no prior finalized episodes (show everyone).
  async function fetchEligibleForVotedOff(epNumber: number): Promise<Set<number> | null> {
    const prevEp = pastEpisodes
      .filter((ep) => ep.is_finalized && ep.episode_number < epNumber)
      .sort((a, b) => b.episode_number - a.episode_number)[0];
    if (!prevEp) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from("castaway_events")
      .select("castaway_id")
      .eq("episode_id", prevEp.id)
      .eq("event_type", "survived_episode");
    return new Set((data ?? []).map((r: { castaway_id: number }) => r.castaway_id));
  }

  const castawayMap = useMemo(() => {
    const map: Record<number, Castaway> = {};
    (castaways ?? []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [castaways]);

  // ── Card toggle ────────────────────────────────────────────────────────────

  function toggleCard(card: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  }

  // ── Set-based helpers ──────────────────────────────────────────────────────

  function toggleInSet(setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVotedOffDetail(castawayId: number, detail: string) {
    setVotedOffDetails((prev) => {
      const current = new Set(prev[castawayId] ?? []);
      if (current.has(detail)) current.delete(detail);
      else current.add(detail);
      return { ...prev, [castawayId]: current };
    });
  }

  function toggleIdolPlay(castawayId: number) {
    setIdolPlays((prev) => {
      const next = { ...prev };
      if (next[castawayId]) delete next[castawayId];
      else next[castawayId] = "correct";
      return next;
    });
  }

  function cycleIdolResult(castawayId: number) {
    setIdolPlays((prev) => ({
      ...prev,
      [castawayId]: prev[castawayId] === "correct" ? "incorrect" : "correct",
    }));
  }

  function toggleShotInDark(castawayId: number) {
    setShotInDark((prev) => {
      const next = { ...prev };
      if (next[castawayId]) delete next[castawayId];
      else next[castawayId] = "success";
      return next;
    });
  }

  function cycleShotResult(castawayId: number) {
    setShotInDark((prev) => ({
      ...prev,
      [castawayId]: prev[castawayId] === "success" ? "fail" : "success",
    }));
  }

  function toggleMilestone(event: string, castawayId: number) {
    setMilestones((prev) => {
      const current = new Set(prev[event] ?? []);
      if (current.has(castawayId)) current.delete(castawayId);
      else current.add(castawayId);
      return { ...prev, [event]: current };
    });
  }

  // ── Reset state ────────────────────────────────────────────────────────────

  function resetEventState() {
    setVotedOff(new Set());
    setVotedOffDetails({});
    setImmunityWinners(new Set());
    setRewardWinners(new Set());
    setIdolsFound(new Set());
    setAdvantagesFound(new Set());
    setIdolPlays({});
    setShotInDark({});
    setMilestones({});
    setEligibleForVotedOff(null);
    setExpandedCards(new Set(["votedOff"]));
    setIsMerge(false);
    setIsFinale(false);
    setShowEpisodeOptions(false);
    setFinalizeResult(null);
  }

  // ── Build events array ─────────────────────────────────────────────────────

  function buildEvents(): { episode_id: number; castaway_id: number; event_type: EventType }[] {
    if (!episodeId) return [];
    const result: { episode_id: number; castaway_id: number; event_type: EventType }[] = [];
    const add = (castawayId: number, event: EventType) =>
      result.push({ episode_id: episodeId, castaway_id: castawayId, event_type: event });

    activeCastaways.forEach((c) => {
      if (!votedOff.has(c.id)) add(c.id, "survived_episode");
    });

    votedOff.forEach((id) => {
      const details = votedOffDetails[id];
      if (details?.has("quit")) add(id, "quit");
      if (details?.has("unanimous")) add(id, "voted_out_unanimously");
      if (details?.has("idol")) add(id, "voted_out_with_idol");
      if (details?.has("advantage")) add(id, "voted_out_with_advantage");
      if (details?.has("first_boot")) add(id, "first_boot");
    });

    immunityWinners.forEach((id) => add(id, "individual_immunity_win"));
    rewardWinners.forEach((id) => add(id, "individual_reward_win"));
    idolsFound.forEach((id) => add(id, "idol_found"));
    advantagesFound.forEach((id) => add(id, "advantage_found"));

    Object.entries(idolPlays).forEach(([id, res]) =>
      add(Number(id), res === "correct" ? "idol_played_correct" : "idol_played_incorrect")
    );
    Object.entries(shotInDark).forEach(([id, res]) =>
      add(Number(id), res === "success" ? "shot_in_dark_success" : "shot_in_dark_fail")
    );
    Object.entries(milestones).forEach(([event, ids]) =>
      ids.forEach((id) => add(id, event as EventType))
    );

    return result;
  }

  // ── Episode creation/resume ────────────────────────────────────────────────

  async function startEpisode(num: number) {
    setIsCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("episodes")
      .upsert({ episode_number: num }, { onConflict: "episode_number" })
      .select()
      .single();

    setIsCreating(false);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      resetEventState();
      setEpisodeNumber(data.episode_number);
      setEpisodeId(data.id);
      setIsMerge(data.is_merge ?? false);
      setIsFinale(data.is_finale ?? false);
      fetchEligibleForVotedOff(data.episode_number).then(setEligibleForVotedOff);
    }
  }

  async function resumeEpisode(ep: EpisodeRow) {
    // Load any existing events (handles cases where the episode was partially
    // finalized then reopened, leaving some castaways marked inactive in the DB).
    await openEpisode(ep);
  }

  async function openEpisode(ep: EpisodeRow) {
    setIsLoadingEvents(true);
    resetEventState();
    setEpisodeNumber(ep.episode_number);
    setEpisodeId(ep.id);
    setIsMerge(ep.is_merge ?? false);
    setIsFinale(ep.is_finale ?? false);

    const supabase = createClient();
    const { data: events } = await supabase
      .from("castaway_events")
      .select("castaway_id, event_type")
      .eq("episode_id", ep.id) as { data: { castaway_id: number; event_type: string }[] | null };

    if (events) {
      const off = new Set<number>();
      const offDetails: Record<number, Set<string>> = {};
      const immunity = new Set<number>();
      const reward = new Set<number>();
      const idolF = new Set<number>();
      const advF = new Set<number>();
      const idolP: Record<number, IdolPlayResult> = {};
      const sitd: Record<number, ShotResult> = {};
      const mile: Record<string, Set<number>> = {};

      for (const { castaway_id, event_type } of events) {
        switch (event_type) {
          case "survived_episode": break;
          case "quit":
          case "voted_out_unanimously":
          case "voted_out_with_idol":
          case "voted_out_with_advantage":
          case "first_boot": {
            off.add(castaway_id);
            if (!offDetails[castaway_id]) offDetails[castaway_id] = new Set();
            const key =
              event_type === "quit" ? "quit" :
              event_type === "voted_out_unanimously" ? "unanimous" :
              event_type === "voted_out_with_idol" ? "idol" :
              event_type === "voted_out_with_advantage" ? "advantage" :
              "first_boot";
            offDetails[castaway_id].add(key);
            break;
          }
          case "individual_immunity_win": immunity.add(castaway_id); break;
          case "individual_reward_win": reward.add(castaway_id); break;
          case "idol_found": idolF.add(castaway_id); break;
          case "advantage_found": advF.add(castaway_id); break;
          case "idol_played_correct": idolP[castaway_id] = "correct"; break;
          case "idol_played_incorrect": idolP[castaway_id] = "incorrect"; break;
          case "shot_in_dark_success": sitd[castaway_id] = "success"; break;
          case "shot_in_dark_fail": sitd[castaway_id] = "fail"; break;
          default: {
            if (!mile[event_type]) mile[event_type] = new Set();
            mile[event_type].add(castaway_id);
            break;
          }
        }
      }

      const survivedIds = new Set(
        events.filter((e) => e.event_type === "survived_episode").map((e) => e.castaway_id)
      );
      const allActive = (castaways ?? []).filter((c) => c.is_active || off.has(c.id));
      for (const c of allActive) {
        if (!survivedIds.has(c.id) && !off.has(c.id)) off.add(c.id);
      }

      setVotedOff(off);
      setVotedOffDetails(offDetails);
      setImmunityWinners(immunity);
      setRewardWinners(reward);
      setIdolsFound(idolF);
      setAdvantagesFound(advF);
      setIdolPlays(idolP);
      setShotInDark(sitd);
      setMilestones(mile);
    }

    fetchEligibleForVotedOff(ep.episode_number).then(setEligibleForVotedOff);
    setIsLoadingEvents(false);
  }

  // ── Finalization ───────────────────────────────────────────────────────────

  async function handleFinalize() {
    if (!episodeId) return;
    const eventsToInsert = buildEvents();
    const confirmed = window.confirm(
      `Finalize Episode ${episodeNumber}? This will save ${eventsToInsert.length} events and recalculate all player scores.`
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    setFinalizeResult(null);
    try {
      const supabase = createClient();

      if (eventsToInsert.length > 0) {
        const { error } = await supabase
          .from("castaway_events")
          .upsert(eventsToInsert, { onConflict: "episode_id,castaway_id,event_type" });
        if (error) throw error;
      }

      await supabase
        .from("episodes")
        .update({ is_finalized: true, is_merge: isMerge, is_finale: isFinale })
        .eq("id", episodeId);

      // Mark departed castaways as inactive
      if (votedOff.size > 0) {
        const mergeHappened =
          isMerge || pastEpisodes.some((ep) => ep.is_merge && ep.is_finalized);
        const alreadyEliminated = (castaways ?? []).filter((c) => !c.is_active).length;

        let bootIdx = 0;
        for (const id of votedOff) {
          const details = votedOffDetails[id];
          const isFirstBoot =
            details?.has("first_boot") ||
            (episodeNumber === 1 && alreadyEliminated === 0 && votedOff.size === 1);
          const hasPlaced3rd = milestones["placed_3rd"]?.has(id);
          const hasRunnerUp = milestones["placed_runner_up"]?.has(id);
          const hasWinner = milestones["sole_survivor"]?.has(id);

          let finalPlacement: string | null = null;
          if (hasWinner) finalPlacement = "winner";
          else if (hasRunnerUp) finalPlacement = "runner_up";
          else if (hasPlaced3rd) finalPlacement = "3rd";
          else if (isFirstBoot) finalPlacement = "first_boot";
          else if (!mergeHappened) finalPlacement = "pre_merge";
          else finalPlacement = "jury";

          await supabase
            .from("castaways")
            .update({
              is_active: false,
              boot_order: alreadyEliminated + bootIdx + 1,
              final_placement: finalPlacement,
            })
            .eq("id", id);
          bootIdx++;
        }
      }

      await supabase
        .from("season_config")
        .update({ current_episode: episodeNumber })
        .eq("id", 1);

      // Call Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`;
      const fnRes = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ episode_id: episodeId }),
      });

      if (!fnRes.ok) {
        const body = await fnRes.text();
        throw new Error(`Score calc failed (${fnRes.status}): ${body}`);
      }

      queryClient.invalidateQueries();

      // Refresh episodes list
      const { data: updatedEps } = await supabase
        .from("episodes")
        .select("id, episode_number, is_finalized, is_merge, is_finale, created_at")
        .order("episode_number", { ascending: true });
      setPastEpisodes(updatedEps ?? []);

      setFinalizeResult(`Episode ${episodeNumber} finalized! Scores updated.`);
      setEpisodeId(null);
      setEpisodeNumber(0);
    } catch (e: any) {
      setFinalizeResult(`Error: ${e.message}`);
    } finally {
      setIsFinalizing(false);
    }
  }

  // ── Loading / auth guard ───────────────────────────────────────────────────

  if (isAuthLoading || castawaysLoading || isLoadingEvents) {
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
      <div className="flex flex-col items-center py-20">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Access denied.</p>
      </div>
    );
  }

  // ── Episode list view ──────────────────────────────────────────────────────

  const highestFinalized = pastEpisodes
    .filter((ep) => ep.is_finalized)
    .reduce((max, ep) => Math.max(max, ep.episode_number), 0);
  const draftEpisode = pastEpisodes.find((ep) => !ep.is_finalized);
  const finaleFinalized = pastEpisodes.some((ep) => ep.is_finale && ep.is_finalized);
  const nextEpisodeNumber = highestFinalized + 1;
  const canStartNew = !draftEpisode && !finaleFinalized;

  if (!episodeId) {
    return (
      <div className="space-y-4 pb-8">
        <h1 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
          Log Episode Events
        </h1>

        {finalizeResult && (
          <div
            className="px-4 py-3 rounded-xl text-sm border"
            style={{
              color: finalizeResult.startsWith("Error") ? "var(--color-error)" : "var(--color-text-secondary)",
              backgroundColor: finalizeResult.startsWith("Error") ? "rgba(255,59,48,0.06)" : "rgba(34,197,94,0.06)",
              borderColor: finalizeResult.startsWith("Error") ? "rgba(255,59,48,0.2)" : "rgba(34,197,94,0.2)",
            }}
          >
            {finalizeResult}
          </div>
        )}

        {/* Finalized episodes */}
        {pastEpisodes.some((ep) => ep.is_finalized) && (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-secondary)",
                borderColor: "var(--color-border)",
              }}
            >
              Logged Episodes
            </div>
            {pastEpisodes
              .filter((ep) => ep.is_finalized)
              .map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => openEpisode(ep)}
                  className="w-full flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:opacity-80 transition-opacity text-left"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      Episode {ep.episode_number}
                      {ep.is_merge ? " · Merge" : ""}
                      {ep.is_finale ? " · Finale" : ""}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Finalized — tap to view/edit
                    </div>
                  </div>
                  <span style={{ color: "var(--color-text-muted)" }}>›</span>
                </button>
              ))}
          </div>
        )}

        {/* Draft episode */}
        {draftEpisode && (
          <button
            onClick={() => resumeEpisode(draftEpisode)}
            className="w-full flex items-center justify-between px-4 py-4 rounded-xl border hover:opacity-80 transition-opacity text-left"
            style={{
              backgroundColor: "rgba(245,127,23,0.08)",
              borderColor: "rgba(245,127,23,0.3)",
            }}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Episode {draftEpisode.episode_number}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(245,127,23,0.9)" }}>
                Draft — tap to continue
              </div>
            </div>
            <span style={{ color: "rgba(245,127,23,0.7)" }}>›</span>
          </button>
        )}

        {/* Start new episode */}
        {canStartNew && (
          <button
            onClick={() => startEpisode(nextEpisodeNumber)}
            disabled={isCreating}
            className="w-full py-4 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {isCreating ? "Starting..." : `Log Episode ${nextEpisodeNumber}`}
          </button>
        )}

        {!canStartNew && !draftEpisode && finaleFinalized && (
          <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
            Season complete — finale has been finalized.
          </p>
        )}
      </div>
    );
  }

  // ── Logging form ───────────────────────────────────────────────────────────

  const allEvents = buildEvents();

  return (
    <div className="space-y-3 pb-32">
      {/* Episode header */}
      <div
        className="rounded-xl px-4 py-3 border"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <button
          onClick={() => setShowEpisodeOptions((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <h1 className="text-xl font-black" style={{ color: "var(--color-text)" }}>
            Episode {episodeNumber}
            {isMerge ? " · Merge" : ""}
            {isFinale ? " · Finale" : ""}
          </h1>
          <span style={{ color: "var(--color-text-muted)" }}>{showEpisodeOptions ? "▾" : "▸"}</span>
        </button>
        {showEpisodeOptions && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setIsMerge((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              style={{
                backgroundColor: isMerge ? "var(--color-primary)" : "transparent",
                color: isMerge ? "#fff" : "var(--color-text-secondary)",
                borderColor: isMerge ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              Merge
            </button>
            <button
              onClick={() => setIsFinale((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              style={{
                backgroundColor: isFinale ? "var(--color-primary)" : "transparent",
                color: isFinale ? "#fff" : "var(--color-text-secondary)",
                borderColor: isFinale ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              Finale
            </button>
          </div>
        )}
      </div>

      {/* 1. Voted Off & Quit */}
      <CategoryCard
        title="Voted Off & Quit"
        count={votedOff.size}
        expanded={expandedCards.has("votedOff")}
        onToggle={() => toggleCard("votedOff")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who left the game this episode?
        </p>
        <CastawayChipGrid
          castaways={votedOffGridCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={votedOff}
          onToggle={(id) => toggleInSet(setVotedOff, id)}
        />
        {votedOff.size > 0 && (
          <div className="mt-3 space-y-2">
            {Array.from(votedOff).map((id) => (
              <div key={id} className="space-y-1.5">
                <div className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {castawayMap[id]?.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "quit", label: "Quit" },
                    { key: "unanimous", label: "Unanimous" },
                    { key: "idol", label: "Had Idol" },
                    { key: "advantage", label: "Had Advantage" },
                    ...(episodeNumber === 1 ? [{ key: "first_boot", label: "First Boot" }] : []),
                  ].map(({ key, label }) => {
                    const active = votedOffDetails[id]?.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleVotedOffDetail(id, key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors"
                        style={{
                          backgroundColor: active ? "var(--color-primary)" : "transparent",
                          color: active ? "#fff" : "var(--color-text-secondary)",
                          borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CategoryCard>

      {/* 2. Individual Immunity */}
      <CategoryCard
        title="Individual Immunity"
        count={immunityWinners.size}
        expanded={expandedCards.has("immunity")}
        onToggle={() => toggleCard("immunity")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who won individual immunity?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={immunityWinners}
          onToggle={(id) => toggleInSet(setImmunityWinners, id)}
        />
      </CategoryCard>

      {/* 3. Individual Reward */}
      <CategoryCard
        title="Individual Reward"
        count={rewardWinners.size}
        expanded={expandedCards.has("reward")}
        onToggle={() => toggleCard("reward")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who won individual reward?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={rewardWinners}
          onToggle={(id) => toggleInSet(setRewardWinners, id)}
        />
      </CategoryCard>

      {/* 4. Idols Found */}
      <CategoryCard
        title="Idols Found"
        count={idolsFound.size}
        expanded={expandedCards.has("idolFound")}
        onToggle={() => toggleCard("idolFound")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who found an idol?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={idolsFound}
          onToggle={(id) => toggleInSet(setIdolsFound, id)}
        />
      </CategoryCard>

      {/* 5. Advantages Found */}
      <CategoryCard
        title="Advantages Found"
        count={advantagesFound.size}
        expanded={expandedCards.has("advantageFound")}
        onToggle={() => toggleCard("advantageFound")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who found an advantage?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={advantagesFound}
          onToggle={(id) => toggleInSet(setAdvantagesFound, id)}
        />
      </CategoryCard>

      {/* 6. Idol Plays */}
      <CategoryCard
        title="Idol Plays"
        count={Object.keys(idolPlays).length}
        expanded={expandedCards.has("idolPlay")}
        onToggle={() => toggleCard("idolPlay")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who played an idol?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={new Set(Object.keys(idolPlays).map(Number))}
          onToggle={toggleIdolPlay}
        />
        {Object.keys(idolPlays).length > 0 && (
          <div className="mt-3 space-y-2">
            {Object.entries(idolPlays).map(([id, result]) => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {castawayMap[Number(id)]?.name}
                </span>
                <button
                  onClick={() => cycleIdolResult(Number(id))}
                  className="px-3 py-1 rounded-lg text-xs font-bold border"
                  style={{
                    backgroundColor: result === "correct" ? "rgba(34,197,94,0.1)" : "rgba(255,59,48,0.1)",
                    color: result === "correct" ? "#22c55e" : "var(--color-error)",
                    borderColor: result === "correct" ? "rgba(34,197,94,0.3)" : "rgba(255,59,48,0.3)",
                  }}
                >
                  {result === "correct" ? "Correct" : "Incorrect"}
                </button>
              </div>
            ))}
          </div>
        )}
      </CategoryCard>

      {/* 7. Shot in the Dark */}
      <CategoryCard
        title="Shot in the Dark"
        count={Object.keys(shotInDark).length}
        expanded={expandedCards.has("shotInDark")}
        onToggle={() => toggleCard("shotInDark")}
      >
        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
          Who played Shot in the Dark?
        </p>
        <CastawayChipGrid
          castaways={remainingCastaways}
          byTribe={byTribe ?? {}}
          tribeColors={tribeColors}
          selected={new Set(Object.keys(shotInDark).map(Number))}
          onToggle={toggleShotInDark}
        />
        {Object.keys(shotInDark).length > 0 && (
          <div className="mt-3 space-y-2">
            {Object.entries(shotInDark).map(([id, result]) => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {castawayMap[Number(id)]?.name}
                </span>
                <button
                  onClick={() => cycleShotResult(Number(id))}
                  className="px-3 py-1 rounded-lg text-xs font-bold border"
                  style={{
                    backgroundColor: result === "success" ? "rgba(34,197,94,0.1)" : "rgba(255,59,48,0.1)",
                    color: result === "success" ? "#22c55e" : "var(--color-error)",
                    borderColor: result === "success" ? "rgba(34,197,94,0.3)" : "rgba(255,59,48,0.3)",
                  }}
                >
                  {result === "success" ? "Safe" : "Not Safe"}
                </button>
              </div>
            ))}
          </div>
        )}
      </CategoryCard>

      {/* 8. Made Jury (merge only) */}
      {isMerge && (
        <CategoryCard
          title="Made Jury"
          count={(milestones["made_jury"] ?? new Set()).size}
          expanded={expandedCards.has("madeJury")}
          onToggle={() => toggleCard("madeJury")}
        >
          <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
            Who made the jury?
          </p>
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe ?? {}}
            tribeColors={tribeColors}
            selected={milestones["made_jury"] ?? new Set<number>()}
            onToggle={(id) => toggleMilestone("made_jury", id)}
          />
        </CategoryCard>
      )}

      {/* 9. Finale Milestones (finale only) */}
      {isFinale && (
        <CategoryCard
          title="Finale Milestones"
          count={FINALE_MILESTONES.reduce((sum, e) => sum + (milestones[e]?.size ?? 0), 0)}
          expanded={expandedCards.has("milestones")}
          onToggle={() => toggleCard("milestones")}
        >
          <div className="space-y-4">
            {FINALE_MILESTONES.map((event) => (
              <div key={event}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  {EVENT_LABELS[event] ?? event}
                </p>
                <CastawayChipGrid
                  castaways={remainingCastaways}
                  byTribe={byTribe ?? {}}
                  tribeColors={tribeColors}
                  selected={milestones[event] ?? new Set<number>()}
                  onToggle={(id) => toggleMilestone(event, id)}
                />
              </div>
            ))}
          </div>
        </CategoryCard>
      )}

      {/* Review summary */}
      <div
        className="rounded-xl px-4 py-4 border space-y-3"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
            Review
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {allEvents.length} events will be logged
          </div>
        </div>
        {allEvents.length > 0 && (
          <div className="space-y-1">
            {summarizeEvents(allEvents, castawayMap).map(({ name, events }, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {name}
                </span>
                <span className="text-xs text-right" style={{ color: "var(--color-text-muted)" }}>
                  {events}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {finalizeResult && (
        <p
          className="text-xs px-1"
          style={{
            color: finalizeResult.startsWith("Error") ? "var(--color-error)" : "var(--color-text-secondary)",
          }}
        >
          {finalizeResult}
        </p>
      )}

      {/* Finalize button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <button
          onClick={handleFinalize}
          disabled={isFinalizing}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {isFinalizing ? "Finalizing..." : "Finalize Episode & Update Scores"}
        </button>
      </div>
    </div>
  );
}

// ─── Helper: summarize events for review ──────────────────────────────────────

function summarizeEvents(
  events: { castaway_id: number; event_type: EventType }[],
  castawayMap: Record<number, Castaway>
) {
  const grouped: Record<number, EventType[]> = {};
  events.forEach(({ castaway_id, event_type }) => {
    if (!grouped[castaway_id]) grouped[castaway_id] = [];
    grouped[castaway_id].push(event_type);
  });

  const EVENT_LABELS_LOCAL: Record<string, string> = {
    individual_immunity_win: "Immunity",
    individual_reward_win: "Reward",
    idol_found: "Found Idol",
    advantage_found: "Found Advantage",
    idol_played_correct: "Idol (Correct)",
    idol_played_incorrect: "Idol (Incorrect)",
    shot_in_dark_success: "SITD Safe",
    shot_in_dark_fail: "SITD Unsafe",
    fire_making_win: "Fire Making",
    final_immunity_win: "Final Immunity",
    voted_out_unanimously: "Unanimous",
    voted_out_with_idol: "Out w/ Idol",
    voted_out_with_advantage: "Out w/ Adv",
    quit: "Quit",
    first_boot: "First Boot",
    made_jury: "Jury",
    placed_3rd: "3rd",
    placed_runner_up: "Runner-Up",
    sole_survivor: "Winner",
  };

  return Object.entries(grouped)
    .map(([id, eventList]) => ({
      name: castawayMap[Number(id)]?.name ?? `#${id}`,
      events:
        eventList
          .filter((e) => e !== "survived_episode")
          .map((e) => EVENT_LABELS_LOCAL[e] ?? e)
          .join(", ") || "Survived",
    }))
    .sort((a, b) => {
      if (a.events === "Survived" && b.events !== "Survived") return 1;
      if (a.events !== "Survived" && b.events === "Survived") return -1;
      return a.name.localeCompare(b.name);
    });
}

// ─── CategoryCard ──────────────────────────────────────────────────────────────

function CategoryCard({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {title}
          </span>
          {count > 0 && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center text-white"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {count}
            </span>
          )}
        </div>
        <span style={{ color: "var(--color-text-muted)" }}>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── CastawayChipGrid ──────────────────────────────────────────────────────────

function CastawayChipGrid({
  castaways,
  byTribe,
  tribeColors,
  selected,
  onToggle,
}: {
  castaways: Castaway[];
  byTribe: Record<string, Castaway[]>;
  tribeColors: Record<string, string>;
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const activeIds = new Set(castaways.map((c) => c.id));
  const tribes = Object.keys(byTribe).sort();

  return (
    <div className="space-y-2">
      {tribes.map((tribe) => {
        const tribeMembers = (byTribe[tribe] ?? []).filter((c) => activeIds.has(c.id));
        if (tribeMembers.length === 0) return null;
        const tribeColor = tribeColors[tribe] ?? "#8E8E93";
        return (
          <div key={tribe}>
            <div
              className="text-xs font-bold uppercase tracking-wider mb-1.5"
              style={{ color: tribeColor }}
            >
              {tribe}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tribeMembers.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggle(c.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    style={{
                      backgroundColor: isSelected ? tribeColor : "transparent",
                      color: isSelected ? "#fff" : "var(--color-text-secondary)",
                      borderColor: isSelected ? tribeColor : "var(--color-border)",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
