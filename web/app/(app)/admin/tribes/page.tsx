"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useCastaways } from "@/hooks/useCastaways";
import { useTribeColors, useTribeColorMutation } from "@/hooks/useTribeColors";
import type { Castaway } from "@shared/types";

const COLOR_PRESETS = [
  "#2E7D32", "#1565C0", "#F57F17", "#8E24AA",
  "#D84315", "#00838F", "#C62828", "#8E8E93",
  "#4E342E", "#1B5E20",
];

export default function TribesAdminPage() {
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();

  const { data: castaways, isLoading: castawaysLoading } = useCastaways();
  const tribeColors = useTribeColors();
  const colorMutation = useTribeColorMutation();

  const [changes, setChanges] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [colorPickerTribe, setColorPickerTribe] = useState<string | null>(null);
  const [newTribeInputs, setNewTribeInputs] = useState<Record<number, string>>({});

  const sortedCastaways = useMemo(
    () =>
      [...(castaways ?? [])].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [castaways]
  );

  const grouped = useMemo(() => {
    const result: Record<string, Castaway[]> = {};
    for (const c of sortedCastaways) {
      const tribe = changes[c.id] ?? c.current_tribe;
      if (!result[tribe]) result[tribe] = [];
      result[tribe].push(c);
    }
    return result;
  }, [sortedCastaways, changes]);

  const tribes = Object.keys(grouped).sort();

  const allTribeNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of sortedCastaways) names.add(changes[c.id] ?? c.current_tribe);
    return Array.from(names).sort();
  }, [sortedCastaways, changes]);

  const hasChanges = Object.keys(changes).length > 0;

  function assignToTribe(castawayId: number, tribe: string) {
    const castaway = sortedCastaways.find((c) => c.id === castawayId);
    if (castaway && castaway.current_tribe === tribe) {
      setChanges((prev) => {
        const next = { ...prev };
        delete next[castawayId];
        return next;
      });
    } else {
      setChanges((prev) => ({ ...prev, [castawayId]: tribe }));
    }
  }

  async function handleSave() {
    if (!hasChanges) return;
    setIsSaving(true);
    setSaveResult(null);
    try {
      const supabase = createClient();
      for (const [idStr, tribe] of Object.entries(changes)) {
        const { error } = await supabase
          .from("castaways")
          .update({ current_tribe: tribe })
          .eq("id", Number(idStr));
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["castaways"] });
      setChanges({});
      setSaveResult(`Updated ${Object.keys(changes).length} castaway(s).`);
    } catch (e: any) {
      setSaveResult(`Error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isAuthLoading || castawaysLoading) {
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

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
          Manage Tribes
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Use the dropdown to move a castaway to a different tribe. Click a tribe color swatch to change its color.
        </p>
      </div>

      {/* Tribe sections */}
      {tribes.map((tribe) => {
        const tribeColor = tribeColors[tribe] ?? "#8E8E93";
        const members = grouped[tribe] ?? [];
        const isPickingColor = colorPickerTribe === tribe;

        return (
          <div
            key={tribe}
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {/* Tribe header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setColorPickerTribe(isPickingColor ? null : tribe)}
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                  style={{ backgroundColor: tribeColor, borderColor: "var(--color-border)" }}
                  title="Change tribe color"
                />
                <span className="text-sm font-black tracking-wider" style={{ color: tribeColor }}>
                  {tribe}
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {members.filter((m) => m.is_active).length} active
              </span>
            </div>

            {/* Color picker */}
            {isPickingColor && (
              <div className="flex flex-wrap gap-2 py-1">
                {COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => {
                      colorMutation.mutate({ tribe, color: hex });
                      setColorPickerTribe(null);
                    }}
                    className="w-7 h-7 rounded-full border-2"
                    style={{
                      backgroundColor: hex,
                      borderColor: hex === tribeColor ? "var(--color-text)" : "transparent",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Castaways */}
            <div className="space-y-1.5">
              {members.map((c) => {
                const isChanged = changes[c.id] !== undefined;
                const originalTribeColor = tribeColors[c.original_tribe] ?? "#8E8E93";
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: isChanged
                        ? "rgba(245,127,23,0.08)"
                        : "var(--color-background)",
                      border: `1px solid ${isChanged ? "rgba(245,127,23,0.3)" : "var(--color-border)"}`,
                      opacity: c.is_active ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: originalTribeColor }}
                    />
                    <span
                      className="flex-1 text-sm font-medium"
                      style={{
                        color: "var(--color-text)",
                        textDecoration: c.is_active ? "none" : "line-through",
                      }}
                    >
                      {c.name}
                    </span>
                    {c.is_active && (
                      <select
                        value={changes[c.id] ?? c.current_tribe}
                        onChange={(e) => assignToTribe(c.id, e.target.value)}
                        className="text-xs rounded-lg px-2 py-1 outline-none"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {allTribeNames.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="__new__">+ New tribe…</option>
                      </select>
                    )}
                    {c.is_active && (changes[c.id] === "__new__" || newTribeInputs[c.id] !== undefined) && (
                      <input
                        autoFocus
                        type="text"
                        placeholder="Tribe name"
                        value={newTribeInputs[c.id] ?? ""}
                        onChange={(e) => setNewTribeInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const name = (newTribeInputs[c.id] ?? "").trim().toUpperCase();
                            if (name) {
                              assignToTribe(c.id, name);
                              setNewTribeInputs((prev) => {
                                const next = { ...prev };
                                delete next[c.id];
                                return next;
                              });
                            }
                          }
                          if (e.key === "Escape") {
                            setNewTribeInputs((prev) => {
                              const next = { ...prev };
                              delete next[c.id];
                              return next;
                            });
                            setChanges((prev) => {
                              const next = { ...prev };
                              delete next[c.id];
                              return next;
                            });
                          }
                        }}
                        className="text-xs rounded-lg px-2 py-1 outline-none w-28"
                        style={{
                          backgroundColor: "var(--color-background)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-primary)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {saveResult && (
        <p
          className="text-xs px-1"
          style={{
            color: saveResult.startsWith("Error")
              ? "var(--color-error)"
              : "var(--color-text-secondary)",
          }}
        >
          {saveResult}
        </p>
      )}

      {/* Save footer */}
      {hasChanges && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t flex gap-3"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <button
            onClick={() => setChanges({})}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {isSaving ? "Saving..." : `Save Changes (${Object.keys(changes).length})`}
          </button>
        </div>
      )}
    </div>
  );
}
