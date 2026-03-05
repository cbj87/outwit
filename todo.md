# Outwit Open — Codebase Review & Recommendations

Comprehensive review of the codebase as of 2026-03-04.

---

## Critical / Security

- [ ] **Fix JWT verification in calculate-scores Edge Function** — Token is decoded via `atob` but NOT cryptographically verified. Anyone can forge a JWT with an arbitrary user ID. Use proper `jwt.verify()` with `SUPABASE_JWT_SECRET`. `supabase/functions/calculate-scores/index.ts:89-98`
- [ ] **Fix RLS: picks reveal leaks across groups** — If ANY of a user's groups has `picks_revealed = true`, they can see ALL picks globally. Policy should also verify the pick belongs to a player in that revealed group. `supabase/migrations/010_fix_picks_rls_for_groups.sql:14-24`
- [ ] **Fix RLS: prophecy answers have same cross-group leak** — Same issue as picks reveal. `supabase/migrations/010_fix_picks_rls_for_groups.sql:74-84`
- [ ] **Restrict profiles RLS read policy** — Currently `USING (true)` exposes email and push_token to all authenticated users. Restrict to own profile + same-group members. `002_rls_policies.sql:36-39`
- [ ] **Add auth to lock-picks Edge Function** — No service role or secret header verification. Anyone who discovers the endpoint can lock all picks. `supabase/functions/lock-picks/index.ts`
- [ ] **Move Supabase credentials to EAS Secrets** — Public anon key and URL are hardcoded in `eas.json` (committed to git). Use EAS Secrets for environment-specific configuration. `eas.json:21-24`
- [ ] **Add avatar delete/update storage policy** — Users can upload avatars but have no RLS policy to delete or replace them. `supabase/migrations/006_avatars_storage.sql`
- [ ] **Clear AsyncStorage on sign-out** — `signOut()` clears Zustand state but Supabase session may persist in AsyncStorage, leaking data on shared devices. `src/hooks/useAuth.ts:74`
- [x] **Fix RLS: score_snapshots overly permissive** — ~~`using (true)` lets any authenticated user read any group's snapshots.~~ Replaced with group-scoped policy in `015_fix_spoiler_protection.sql`.

---

## Bugs

- [ ] **useLeaderboard infinite loading on error** — Early return on error doesn't set `isLoading` to false, leaving spinner indefinitely. `src/hooks/useLeaderboard.ts:79`
- [ ] **useAuth missing try-catch in fetchProfile** — If profile query throws, the component crashes instead of gracefully handling missing profiles. `src/hooks/useAuth.ts:37`
- [ ] **HTML entities don't render in React Native** — `&rarr;` in scoring-rules screen won't display. Use unicode `\u2192` instead. `app/scoring-rules.tsx:102`
- [ ] **prophecy/status useEffect runs every render** — Missing dependency array causes infinite refetch loop. `app/prophecy/status.tsx:25-40`
- [ ] **Sequential async calls in tribe save** — For loop with await inside executes sequentially. Use `Promise.all()` for parallel execution. `app/admin/tribes.tsx:348-352`
- [ ] **Avatar cache invalidation too narrow** — Only invalidates `all-picks` on avatar change; should also invalidate leaderboard and other avatar-displaying queries. `app/(tabs)/profile.tsx:162-163`
- [ ] **useCastawayMap creates new Map every render** — Missing `useMemo` causes unnecessary re-renders for all consumers. `src/hooks/useCastaways.ts:46-49`
- [ ] **Episode 0 awards survival points** — `event.episodes?.episode_number ?? 0` falls through to `getSurvivalPoints(0)` which returns 1 point. Should skip events without episodes. `supabase/functions/calculate-scores/index.ts:261`
- [ ] **queryClient.invalidateQueries() without key** — Invalidates ALL queries after episode finalization (too heavy-handed). `app/admin/episode.tsx:429`
- [ ] **Spoiler toggle doesn't rollback on failure** — Switch state updates optimistically but doesn't revert if the Supabase update fails. `app/(tabs)/profile.tsx:328-335`
- [ ] **Fix duplicate migration numbering** — Two `005_` migrations (`episode_flags` and `tribe_columns`) break ordering guarantees. Rename to establish clear order.
- [ ] **Sync package.json and app.json versions** — package.json says 2.0.0, app.json says 4.1.0. Pick single source of truth.

---

## Scoring & Leaderboard

- [ ] **Batch placement updates in calculate-scores** — Edge Function updates castaways one-by-one (N+1). Use a stored procedure or batch operation. `supabase/functions/calculate-scores/index.ts:202-208`
- [ ] **Wrap score writes in a transaction** — `score_cache`, `score_cache_trio_detail`, and `score_snapshots` are written sequentially. If one fails mid-way, data is left inconsistent. `supabase/functions/calculate-scores/index.ts:305-339`
- [ ] **Validate requested group/episode IDs in Edge Function** — Silently succeeds when given an invalid `group_id` or `episode_id`, processing 0 players. Should return 400. `supabase/functions/calculate-scores/index.ts:140-146, 221-224`
- [ ] **Only infer placement for inactive castaways** — Placement fallback logic could mark an active castaway as "jury" if events aren't logged yet. Guard with `is_active = false` check. `supabase/functions/calculate-scores/index.ts:176-200`
- [ ] **Score snapshot fallback indicator** — When leaderboard shows zeroed/pre-season scores because snapshots don't exist, return `isFallbackToPreseason` flag so UI can display a notice. `src/hooks/useLeaderboard.ts:88-111`
- [ ] **Trio detail in snapshot mode** — Currently skipped with comment "no snapshot equivalent exists". Create snapshot equivalent or document limitation. `src/hooks/useMyPicks.ts:35-38`
- [ ] **Materialize leaderboard view** — Ranking logic in `sortAndRankScores()` is computed client-side. A DB view could centralize this and improve performance.
- [x] **Spoiler-safe snapshot gap handling** — Now finds the closest earlier snapshot instead of falling back to live scores.

---

## Picks System

- [ ] **Add DB constraint: trio castaways must be distinct** — No CHECK constraint prevents picking the same castaway in all 3 trio slots. `001_initial_schema.sql:81-91`
- [ ] **Add DB constraint: icky castaway cannot be in trio** — Validation exists client-side (Zod) but not enforced at the database level. `001_initial_schema.sql:81-91`
- [ ] **Conflict detection for picks from multiple devices** — Last write wins with no warning. Show a confirmation if picks were already submitted, or use optimistic locking with `updated_at`.
- [ ] **Pre-submission validation feedback** — Users can't see validation errors until after clicking submit. Show inline errors as they fill out the pick form. `app/picks/submit.tsx`
- [ ] **Create stored procedure for atomic pick submission** — Combine picks insert + conditional lock in one DB call to prevent race conditions.

---

## Groups

- [ ] **Atomic group creation** — `useCreateGroup` does 3 sequential inserts (group, member, profile update). If step 2 fails, an orphaned group exists. Wrap in a stored procedure. `src/hooks/useCreateGroup.ts:27-50`
- [ ] **Error handling on group leave** — If membership delete succeeds but `active_group_id` update fails, user's profile points to a group they left. `src/hooks/useLeaveGroup.ts:23-28`
- [ ] **Revert optimistic update on switch failure** — `useActiveGroup` sets local state before the DB write. No rollback if the update fails. `src/hooks/useActiveGroup.ts`
- [ ] **Group invite link sharing** — Only invite code exists. Add share sheet with deep link (e.g. `outwit://join?code=ABC123`).
- [ ] **Member management for group admins** — No ability to kick/remove members from a group. Add to group settings.
- [ ] **Group settings "not found" dead end** — Shows message with no back button or navigation. `app/groups/[id]/settings.tsx:107-113`

---

## New Features

### Push Notifications
- [ ] **Implement push notification sending** — Token registration exists (`src/lib/notifications.ts`) but no server-side send logic. Key events: score recalculation, picks deadline approaching, episode finalized, picks revealed.

### Authentication
- [ ] **Forgot password flow** — No way to reset password from sign-in screen. Add password reset via Supabase auth.
- [ ] **Password show/hide toggle** — Auth screens lack visibility toggle for password fields.
- [ ] **Password strength indicator** — Sign-up has 6-char minimum but no visual strength feedback.

### Deep Linking
- [ ] **Configure deep linking** — No `linking` setup in `app/_layout.tsx`. Add universal link support for episodes, castaways, group invites.

### Offline Support
- [ ] **Network status detection** — App doesn't detect when user goes offline. Add `NetInfo` listener and offline banner.
- [ ] **TanStack Query persistence** — Optimistic caching + persistence for common read paths so app works offline.

### Search & Filtering
- [ ] **Castaway list search/filter** — No way to filter by tribe, status (active/eliminated), or search by name.
- [ ] **Leaderboard search** — Useful for multi-group UX if groups grow larger.

### Dark Mode
- [ ] **Theme switching support** — No dark/light mode toggle. Add using React Native appearance API + theme context.

### Commissioner Tools
- [ ] **Audit logging** — No record of who finalized episodes, revealed picks, or recalculated scores. Add `audit_logs` table with triggers.
- [ ] **Commissioner undo for picks lock** — `lock-picks` is one-way with no grace period. Add commissioner-triggered unlock.
- [ ] **Debounce the recalculate button** — Commissioner can spam "Recalculate Scores" rapidly.
- [ ] **Prophecy outcome validation** — Simple state cycling (null/true/false) with no confirmation dialog. `app/admin/prophecy.tsx:76`

### Analytics & Stats
- [ ] **Detailed group analytics/stats screen** — Weekly score trends, best/worst picks, head-to-head comparisons, power rankings.
- [ ] **Event tracking** — No visibility into user behavior: screens visited, pick submission funnel, etc.

### Season Management
- [ ] **Refactor useSeasonConfig to be fully group-scoped** — Still fetches global `season_config` (id=1). `src/hooks/useSeasonConfig.ts`
- [ ] **Android build configuration** — `app.json` only has iOS config. Add Android identifiers if Android is planned.

---

## UI/UX Improvements

### Loading & Empty States
- [ ] **Replace loading spinners with skeleton loaders** — Full-screen ActivityIndicators throughout. Use skeleton placeholders for cards, lists, profile sections.
- [ ] **Add contextual loading messages** — Several screens show a bare spinner with no explanation.
- [ ] **Add empty states** — Missing for: no groups joined, no picks submitted, no episodes logged, castaways list, leaderboard before first scoring. Add illustrated empty states with CTAs.

### Error States & Feedback
- [ ] **Add error boundary component** — No error boundaries. React Native crashes show bare error screens with no recovery.
- [ ] **Show error toasts on mutation failures** — Profile updates, episode marking, group operations fail silently. Add toast/snackbar system.
- [ ] **User-friendly error messages** — Auth screens show raw Supabase error messages. Map to friendly text. `app/(auth)/sign-in.tsx:30`
- [ ] **Distinguish RLS 403 errors from network errors** — Surface "permission denied" clearly vs generic error.

### Haptic Feedback
- [ ] **Add haptics on tribe drag activation** — Long-press to drag has no tactile feedback. `app/admin/tribes.tsx:76`
- [ ] **Add haptics on pick selection toggles** — Trio/icky/prophecy selections in pick form. `app/picks/submit.tsx`
- [ ] **Add haptics on card expansions** — Admin collapsible cards. `app/admin/episode.tsx:569`

### Touch Targets & Accessibility
- [ ] **Improve touch target sizes** — Below 44pt minimum: castaway rows 14px padding (`castaways.tsx:82-95`), member rows 12px padding (`groups/[id]/settings.tsx:162-168`), color swatches 20x20px (`admin/tribes.tsx:538-540`).
- [ ] **Add `accessibilityLabel` to interactive elements** — Missing throughout the app.
- [ ] **Add `accessibilityRole` to semantic elements** — Missing role attributes for screen readers.
- [ ] **Add accessible expanded/collapsed states** — Admin collapsible cards have no ARIA state. `app/admin/episode.tsx:58, 569`
- [ ] **Supplement color-only information with text** — Rank colors and tribe colors convey meaning through color alone.

### Navigation & Interaction
- [ ] **Add pull-to-refresh** — Leaderboard and castaways screens should support pull-to-refresh gesture.
- [ ] **Add scroll-to-top on tab re-focus** — FlatList on leaderboard and ScrollView on my-picks don't reset scroll on tab re-select.
- [ ] **Make leaderboard rows tappable before picks reveal** — Currently only tappable when `picksRevealed=true` with no indication of future tappability. `app/(tabs)/index.tsx:271`
- [ ] **Long-press drag discoverability** — Tribe drag requires 300ms long-press with no visual hint. Add grip handles or tooltip. `app/admin/tribes.tsx:75-98`
- [ ] **Add confirmation dialog for destructive actions** — Leaving a group has no confirmation.
- [ ] **Debounce profile "Save Name" button** — Users can click rapidly triggering concurrent updates. `app/(tabs)/profile.tsx`

### Forms & Input
- [ ] **Add KeyboardAvoidingView to missing forms** — Missing on: group create (`groups/create.tsx`), group settings (`groups/[id]/settings.tsx`).
- [ ] **Bio input auto-expanding** — Hardcoded `numberOfLines={4}` doesn't grow with content. `app/profile/bio.tsx:112`
- [ ] **Responsive grid layout** — Player gallery hardcoded to 3 columns; no landscape adjustment. `app/players/gallery.tsx:21-26`

### Visual Polish
- [ ] **Consistent button styling** — Varies between primary and primaryLight with opacity across screens.
- [ ] **Consistent text transforms** — UPPERCASE used inconsistently (prophecy vs admin panels).
- [ ] **Consistent avatar sizes** — 32px on leaderboard vs 64px on other screens for same player data.
- [ ] **Improve disabled state contrast** — Pick cards use `opacity: 0.4` which is hard to distinguish. `app/picks/submit.tsx:238, 279`
- [ ] **Admin panel null return for non-commissioners** — Shows empty screen. Show explanation or hide tab entirely. `app/admin/panel.tsx:48`

---

## Performance

### Database Indexes
- [ ] **Add index on `castaway_events(episode_id)`** — No index. calculate-scores does full table scans.
- [ ] **Add index on `castaway_events(castaway_id)`** — Commonly queried by castaway.
- [ ] **Add index on `picks(player_id)`** — Leaderboard and MyPicks query by player_id with no index.
- [ ] **Add index on `prophecy_answers(player_id)`** — Queried per-player with no index.
- [ ] **Add index on `episode_seen_status(player_id)`** — RLS policy queries by player_id on every read.
- [ ] **Add composite index on `score_cache_trio_detail(player_id, group_id)`** — Common query pattern.
- [ ] **Add composite index on `group_members(group_id, user_id)`** — RLS policies join on this frequently.

### React Native Performance
- [ ] **Memoize useCastawaysByTribe derived data** — Rebuilds `byTribe` object on every hook call. Use `useMemo()`.
- [ ] **Memoize FlatList renderItem callbacks** — `renderItem` not wrapped in `useCallback` on castaways list and leaderboard.
- [ ] **Add removeClippedSubviews to FlatLists** — Leaderboard FlatList renders without virtualization optimization. `app/(tabs)/index.tsx:255-277`
- [ ] **Memoize expensive child components** — PickerRow, CategoryCard, CastawayChipGrid not wrapped in `React.memo`.
- [ ] **Lazy load admin screens** — All admin screens imported in main Stack even for non-commissioners.
- [ ] **Review TanStack Query staleTime/gcTime** — `staleTime: 30s` may be too aggressive for live scores; `gcTime: 24h` may cause memory issues. `app/_layout.tsx:14-22`

### Query Optimization
- [ ] **Filter profiles query in useAllPicks** — Fetches all profiles then filters to group members. Should use `whereIn('id', memberIds)`. `src/hooks/useAllPicks.ts:20-48`
- [ ] **Separate prophecy_outcomes into its own query** — Global data re-fetched every time my-picks cache invalidates. `src/hooks/useMyPicks.ts`
- [ ] **Scope query invalidation on auth change** — `queryClient.invalidateQueries()` invalidates everything including static data. `src/hooks/useAuth.ts:29`
- [ ] **Scope Realtime profile subscription** — Profile updates from any user trigger leaderboard re-fetch. Filter to group members only. `src/hooks/useLeaderboard.ts:124-136`

---

## Architecture & Code Quality

### State Management Consistency
- [ ] **Migrate useLeaderboard to TanStack Query** — Uses manual `useState` + Realtime subscriptions instead of `useQuery`. Inconsistent with other hooks. `src/hooks/useLeaderboard.ts`
- [ ] **Migrate useSeasonConfig to TanStack Query** — Mixes `useState` and Realtime. `src/hooks/useSeasonConfig.ts`
- [ ] **Create reusable Realtime subscription hook** — `useSeasonConfig` and `useLeaderboard` both manually subscribe. Extract to `useSupabaseRealtime(table, filter)`.
- [ ] **Centralize TanStack Query keys** — Hard-coded keys scattered across hooks. Create `src/lib/queryKeys.ts`.
- [ ] **Use query key factories for group-scoped data** — Keys like `['leaderboard']` cause cross-group cache pollution.
- [ ] **Batch auth store updates** — `useAuth` calls multiple individual setters. Create single `setAuthState()` action. `src/hooks/useAuth.ts:8-10`
- [x] **Migrate useEpisodeSeenStatus to TanStack Query** — Done with optimistic updates and automatic rollback.

### Error Handling Consistency
- [ ] **Expose error states consistently across hooks** — Some throw (useCreateGroup, useJoinGroup), some return empty arrays (useBioQuestions), some silently drop errors (useLeaderboard). Standardize.
- [ ] **Fix silent error in useBioQuestions** — Returns `[]` on error, indistinguishable from "no questions". `src/hooks/useBioQuestions.ts:15`
- [ ] **Add retry logic with exponential backoff** — No retry on network failures. Single-attempt only across all hooks.

### Type Safety
- [ ] **Remove `any` type casts** — `useAllPicks.ts:34`, `useGroups.ts:13`, `useMyPicks.ts:49`, `useLeaderboard.ts:74`. Define proper interfaces.
- [ ] **Handle undefined score in leaderboard mapping** — `finalScores.find()` could return undefined. Add null coalescing. `src/hooks/useLeaderboard.ts:99-101`
- [ ] **Guard EVENT_SCORES against unknown event types** — Returns 0 for unrecognized types, masking bugs. Consider throwing or logging. `src/lib/scoring.ts:31`

### Database Constraints
- [ ] **Add CHECK: episode_number >= 1** — Commissioner could create episode 0, breaking sorting. `001_initial_schema.sql`
- [ ] **Add CHECK: is_active vs final_placement** — No constraint prevents `is_active = true` with `final_placement` set. `001_initial_schema.sql:62-75`
- [ ] **Review CASCADE delete on groups** — Deleting a group cascades to everything. Consider `ON DELETE RESTRICT`. `009_multi_group.sql:28,133,136`

### Cleanup
- [ ] **Remove backward-compat TODO in migration 009** — `supabase/migrations/009_multi_group.sql:231`
- [ ] **Use nested episode data from castaway_events** — Edge Function rebuilds an episode map from a separate query when nested data is available. `supabase/functions/calculate-scores/index.ts:154-169`

---

## Testing

- [ ] **Add Edge Function unit tests** — No test coverage for calculate-scores or lock-picks. Test JWT validation, scoring algorithm, and edge cases.
- [ ] **Add RLS integration tests** — No tests verifying RLS policies prevent unauthorized reads/writes.
- [ ] **Add vitest coverage reporting** — vitest.config.ts has no coverage config. Add v8 provider.
- [ ] **Add component tests** — No tests for UI components. Priority: leaderboard rendering, pick submission, spoiler protection.
- [ ] **Add E2E tests** — No end-to-end framework. Consider Maestro or Detox for critical flows.
- [ ] **Add testID props to components** — No `testID` attributes, blocking automated UI testing.
- [x] ~~Add unit tests for scoring logic~~ — Covered in `src/lib/__tests__/scoring.test.ts`.
- [x] ~~Add unit tests for validation schemas~~ — Covered in `src/lib/__tests__/validation.test.ts`.

---

## Documentation & DX

- [ ] **Add `.env.example` file** — No template for required environment variables.
- [ ] **Graceful env var failure** — Supabase client throws during module load if env vars missing. Show developer-friendly error. `src/lib/supabase.ts:4-9`
- [ ] **Document score calculation flow** — Complex multi-step process has no architecture doc.
- [ ] **Document spoiler protection implementation** — Spread across multiple files with no overview.
- [ ] **Add JSDoc to Edge Functions** — Parameter types, return values, and auth requirements undocumented.
- [ ] **Add structured error logging** — No Sentry or similar. Edge Function errors only go to `console.error`.

---

## Data Integrity

- [ ] **Add trigger to auto-create score_cache row on pick submission** — New players have no score_cache entry until commissioner runs calculate-scores.
- [ ] **Add pre-flight validation before score calculation** — No check that all required data exists. Orphaned picks or missing episodes lead to silent score errors.
- [ ] **Validate prophecy outcome count** — No enforcement that exactly 16 outcomes exist. Commissioner could accidentally delete questions, breaking scoring.
- [ ] **Add soft deletes for castaways** — Direct DELETE cascades and loses history. Add `deleted_at` column.
