"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useSeasonConfig } from "@/hooks/useSeasonConfig";
import { useBioQuestions } from "@/hooks/useBioQuestions";
import { PageHeading } from "@/components/PageHeading";
import type { Group } from "@shared/types";

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

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const activeGroup = useAuthStore((s) => s.activeGroup);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setActiveGroup = useAuthStore((s) => s.setActiveGroup);
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const isGroupCommissioner = useAuthStore((s) => s.isGroupCommissioner);
  const reset = useAuthStore((s) => s.reset);
  const { config } = useSeasonConfig();
  const { questions: bioQuestions } = useBioQuestions();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isTogglingSpoiler, setIsTogglingSpoiler] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const { data: groups } = useQuery({
    queryKey: ["my-groups", session?.user.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("group_members")
        .select("groups(*)")
        .eq("user_id", session!.user.id);
      return ((data ?? []).map((r: any) => r.groups).filter(Boolean)) as Group[];
    },
    enabled: !!session?.user.id,
  });

  async function refreshProfile() {
    if (!profile) return;
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
    if (data) setProfile(data);
  }

  async function handleSave() {
    const trimmed = displayName.trim();
    if (!trimmed || !profile) return;
    if (trimmed === profile.display_name) { setIsEditing(false); return; }

    setIsSavingName(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setIsSavingName(false);
    if (err) { setError(err.message); return; }
    await refreshProfile();
    setIsEditing(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${profile.id}/avatar.${ext}`;
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (updateErr) throw updateErr;
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["all-picks"] });
    } catch (e: any) {
      setError(e.message ?? "Could not upload avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleToggleSpoiler(enabled: boolean) {
    if (!profile) return;
    setIsTogglingSpoiler(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("profiles")
        .update({ spoiler_protection: enabled, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (err) throw err;
      if (enabled) {
        const currentEp = config?.current_episode ?? 0;
        if (currentEp > 0) {
          const rows = Array.from({ length: currentEp }, (_, i) => ({
            player_id: profile.id,
            episode_number: i + 1,
          }));
          await supabase.from("episode_seen_status").upsert(rows);
        }
      } else {
        await supabase.from("episode_seen_status").delete().eq("player_id", profile.id);
      }
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["episode-seen-status"] });
    } catch (e: any) {
      setError(e.message ?? "Could not update setting.");
    } finally {
      setIsTogglingSpoiler(false);
    }
  }

  async function handleSwitchGroup(group: Group) {
    if (!profile) return;
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ active_group_id: group.id, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setActiveGroup(group);
    queryClient.invalidateQueries();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    router.push("/sign-in");
  }

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

  if (!profile) {
    router.replace("/sign-in");
    return null;
  }

  const initials = getInitials(profile.display_name ?? "?");

  return (
    <div className="space-y-4 pb-8">
      <PageHeading
        title="Profile"
        right={
          isEditing ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setDisplayName(profile.display_name); setIsEditing(false); setError(null); }}
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSavingName}
                className="text-sm font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {isSavingName ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              Edit
            </button>
          )
        }
      />

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm border"
          style={{
            color: "var(--color-error)",
            backgroundColor: "rgba(255,59,48,0.06)",
            borderColor: "rgba(255,59,48,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Avatar + Name + Email */}
      <div
        className="flex flex-col items-center py-6 gap-2 rounded-xl"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <label className={`relative ${isEditing ? "cursor-pointer" : "cursor-default"}`}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-black"
              style={{ backgroundColor: getAvatarColor(profile.display_name ?? "?") }}
            >
              {initials}
            </div>
          )}
          {isUploadingAvatar && (
            <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
          )}
          {isEditing && (
            <>
              <div
                className="absolute bottom-0 right-0 px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Edit
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarUpload}
                disabled={isUploadingAvatar}
              />
            </>
          )}
        </label>
        <div className="text-xl font-black" style={{ color: "var(--color-text)" }}>
          {profile.display_name}
        </div>
        <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {profile.email}
        </div>
      </div>

      {/* Display name input (edit mode only) */}
      {isEditing && (
        <div
          className="px-4 py-3 rounded-xl"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <label
            className="text-xs font-bold uppercase tracking-wider mb-2 block"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full text-base px-3 py-2 rounded-lg outline-none"
            style={{
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
            placeholder="Your display name"
            autoFocus
          />
        </div>
      )}

      {/* Spoiler Protection */}
      <div
        className="flex items-center justify-between px-4 py-4 rounded-xl"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex-1 mr-4">
          <div className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            Spoiler Protection
          </div>
          <div className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {profile.spoiler_protection
              ? "Scores hidden until you mark episodes as seen"
              : "Enable to avoid spoilers from unseen episodes"}
          </div>
        </div>
        {isTogglingSpoiler ? (
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
          />
        ) : (
          <button
            onClick={() => handleToggleSpoiler(!profile.spoiler_protection)}
            className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: profile.spoiler_protection ? "var(--color-primary)" : "var(--color-border)" }}
          >
            <span
              className="absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: profile.spoiler_protection ? "translateX(26px)" : "translateX(2px)" }}
            />
          </button>
        )}
      </div>

      {/* My Groups */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-text-secondary)" }}>
            My Groups
          </h2>
          <div className="flex gap-4">
            <Link href="/groups/join" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
              Join
            </Link>
            <Link href="/groups/create" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
              Create
            </Link>
          </div>
        </div>
        <div className="space-y-1.5">
          {(groups ?? []).length === 0 ? (
            <div
              className="px-4 py-4 rounded-xl text-sm"
              style={{
                color: "var(--color-text-muted)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              No groups yet. Join or create one to get started.
            </div>
          ) : (
            (groups ?? []).map((group) => {
              const isActive = activeGroup?.id === group.id;
              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: `1px solid ${isActive ? "rgba(196,64,47,0.3)" : "var(--color-border)"}`,
                  }}
                >
                  <button
                    onClick={() => handleSwitchGroup(group)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: isActive ? "var(--color-primary)" : "var(--color-text)" }}
                    >
                      {group.name}
                    </span>
                    {group.created_by === profile.id && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ color: "var(--color-text-muted)", backgroundColor: "var(--color-border)" }}
                      >
                        Admin
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {isActive && (
                      <span className="text-sm font-black" style={{ color: "var(--color-primary)" }}>✓</span>
                    )}
                    <Link
                      href={`/groups/${group.id}/settings`}
                      className="text-xl"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      ›
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Survivor Bio */}
      <Link
        href="/bio"
        className="flex items-center gap-3 px-4 py-4 rounded-xl hover:opacity-80 transition-opacity"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span className="text-2xl">🌴</span>
        <div className="flex-1">
          <div className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            Survivor Bio
          </div>
          <div className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            {(() => {
              const answered = bioQuestions.filter(
                (q) => (profile.survivor_bio as Record<string, string> | null)?.[q.key]?.trim()
              ).length;
              return bioQuestions.length > 0
                ? `${answered} of ${bioQuestions.length} answered`
                : "Fill out your league bio";
            })()}
          </div>
        </div>
        <span className="text-xl" style={{ color: "var(--color-text-muted)" }}>›</span>
      </Link>

      {/* Commissioner Panel */}
      {(isCommissioner || isGroupCommissioner) && (
        <Link
          href="/admin"
          className="flex items-center gap-3 px-4 py-4 rounded-xl hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <span className="text-2xl">🏛️</span>
          <div className="flex-1">
            <div className="text-base font-bold" style={{ color: "var(--color-text)" }}>
              Commissioner Panel
            </div>
            <div className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
              {isCommissioner
                ? "Manage episodes, prophecy outcomes, and scores"
                : "Manage group picks and scores"}
            </div>
          </div>
          <span className="text-xl" style={{ color: "var(--color-text-muted)" }}>›</span>
        </Link>
      )}

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3.5 rounded-xl text-sm font-semibold border"
        style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
      >
        Sign Out
      </button>
    </div>
  );
}
