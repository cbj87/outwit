# Outwit Open — Codebase Review & Recommendations

Comprehensive review of the codebase as of 2026-02-28.

---

## Feature Improvements

### Scoring & Leaderboard

- [ ] **Batch placement updates in calculate-scores** — Edge Function updates castaways one-by-one (N+1). Use a stored procedure or batch operation to fix all placements in a single call. `supabase/functions/calculate-scores/index.ts:202-208`
- [ ] **Wrap score writes in a transaction** — `score_cache`, `score_cache_trio_detail`, and `score_snapshots` are written sequentially. If one fails mid-way, data is left inconsistent. `supabase/functions/calculate-scores/index.ts:305-339`
- [ ] **Validate requested group/episode IDs** — Edge Function silently succeeds when given an invalid `group_id` or `episode_id`, processing 0 players. Should return a 400 error instead. `supabase/functions/calculate-scores/index.ts:140-146, 221-224`
- [ ] **Only infer placement for inactive castaways** — Placement fallback logic could mark an active castaway as "jury" if events aren't logged yet. Guard with `is_active = false` check. `supabase/functions/calculate-scores/index.ts:176-200`
- [x] **Spoiler-safe snapshot gap handling** — ~~If user marks episode 3 as seen but latest finalized is episode 5, snapshot for ep 3 may not exist, causing a silent jump to live scores.~~ Now finds the closest earlier snapshot instead of falling back to live scores. Shows zeroed pre-season scores if no snapshots exist at all.

### Picks System


- [ ] **Add DB constraint: trio castaways must be distinct** — No CHECK constraint prevents picking the same castaway in all 3 trio slots. `supabase/migrations/001_initial_schema.sql:81-91`
- [ ] **Add DB constraint: icky castaway cannot be in trio** — Validation exists client-side (Zod) but not enforced at the database level. `supabase/migrations/001_initial_schema.sql:81-91`
- [ ] **Conflict detection for picks from multiple devices** — Last write wins with no warning. Show a confirmation if picks were already submitted, or use optimistic locking with `updated_at`.
- [ ] **Pre-submission validation feedback** — Users can't see validation errors until after clicking submit. Show inline errors as they fill out the pick form. `app/picks/submit.tsx`

### Groups

- [ ] **Atomic group creation** — `useCreateGroup` does 3 sequential inserts (group, member, profile update). If step 2 fails, an orphaned group exists. Wrap in a stored procedure. `src/hooks/useCreateGroup.ts:27-50`
- [ ] **Error handling on group leave** — If membership delete succeeds but `active_group_id` update fails, user's profile points to a group they left. `src/hooks/useLeaveGroup.ts:23-28`
- [ ] **Revert optimistic update on switch failure** — `useActiveGroup` sets local state before the DB write. No rollback if the update fails. `src/hooks/useActiveGroup.ts`

### Spoiler Protection

- [x] **Add REPLICA IDENTITY FULL to score_snapshots** — ~~Realtime subscriptions on this table won't work properly without it.~~ Fixed in `015_fix_spoiler_protection.sql`.
- [x] **Error feedback on episode seen status** — ~~`markEpisodeSeen` and `unmarkEpisodeSeen` fail silently.~~ Migrated to TanStack Query with optimistic updates, rollback on error, and `Alert.alert` in leaderboard.

---

## New Features

### Push Notifications
- [ ] **Implement push notification sending** — Token registration exists (`src/lib/notifications.ts`) but no server-side code to actually send notifications. Key events to notify: score recalculation, picks deadline approaching, episode finalized, picks revealed.

### Offline Support
- [ ] **Network status detection** — App doesn't detect when user goes offline. Queries fail silently or show stale cached data. Add a `NetInfo` listener and show an offline banner.
- [ ] **Stale-while-revalidate strategy** — Each tab focus refetches all data. Configure TanStack Query's `staleTime` and `gcTime` more aggressively for data that rarely changes (castaways, tribe colors, prophecy questions).

### Search & Filtering
- [ ] **Castaway list filtering** — No way to filter by tribe, status (active/eliminated), or search by name. Important as season progresses.
- [ ] **Leaderboard search** — With 12 players it's fine, but adding search/filter would improve multi-group UX if groups grow larger.

### Commissioner Tools
- [ ] **Audit logging for commissioner actions** — No record of who finalized episodes, revealed picks, or recalculated scores. Add an `audit_log` table with actor, action, timestamp, and payload.
- [ ] **Debounce the recalculate button** — Commissioner can spam "Recalculate Scores" rapidly. Add client-side debouncing or disable the button during recalculation.

### Testing Infrastructure
- [ ] **Add unit tests for scoring logic** — `src/lib/scoring.ts` and `src/lib/constants.ts` have zero test coverage. These are the most critical functions in the app.
- [ ] **Add unit tests for validation schemas** — Zod schemas in `src/lib/validation.ts` should have test cases for edge cases.
- [ ] **Add integration tests for pick submission flow** — End-to-end test covering the multi-step pick wizard.
- [ ] **Add testID props to components** — No `testID` attributes on any components, blocking automated UI testing.

### Season Management
- [ ] **Refactor useSeasonConfig to be fully group-scoped** — Still fetches global `season_config` (id=1) even though all config is now per-group. The Realtime subscription on `season_config` triggers unnecessary re-renders. `src/hooks/useSeasonConfig.ts`
- [ ] **Android build configuration** — `app.json` only has iOS config. Add Android bundle identifier, version code, and adaptive icon if Android is planned.

---

## Code Improvements

### Security

- [ ] **Fix RLS: picks reveal leaks across groups** — If ANY of a user's groups has `picks_revealed = true`, they can see ALL picks globally. Policy should also verify the pick belongs to a player in that revealed group. `supabase/migrations/010_fix_picks_rls_for_groups.sql:14-24`
- [ ] **Fix RLS: prophecy answers have same cross-group leak** — Same issue as picks reveal. `supabase/migrations/010_fix_picks_rls_for_groups.sql:74-84`
- [x] **Fix RLS: score_snapshots overly permissive** — ~~`using (true)` lets any authenticated user read any group's snapshots.~~ Replaced with group-scoped policy in `015_fix_spoiler_protection.sql`.
- [ ] **Add auth to lock-picks Edge Function** — No service role or secret header verification. Anyone who discovers the endpoint can lock all picks. `supabase/functions/lock-picks/index.ts`
- [ ] **Move Supabase credentials to EAS Secrets** — Public anon key and URL are hardcoded in `eas.json` (committed to git). Use EAS Secrets for environment-specific configuration. `eas.json:21-24`
- [ ] **Add avatar delete/update storage policy** — Users can upload avatars but have no RLS policy to delete or replace them. `supabase/migrations/006_avatars_storage.sql`
- [ ] **Clear AsyncStorage on sign-out** — `signOut()` clears Zustand state but Supabase session may persist in AsyncStorage, leaking data on shared devices. `src/hooks/useAuth.ts:74`

### Database Performance

- [ ] **Add index on `castaway_events(episode_id)`** — No index exists. calculate-scores loads all events and filters client-side. `supabase/migrations/001_initial_schema.sql`
- [ ] **Add index on `castaway_events(castaway_id)`** — Same table, commonly queried by castaway. `supabase/migrations/001_initial_schema.sql`
- [ ] **Add index on `picks(player_id)`** — Leaderboard and MyPicks query by player_id with no index. `supabase/migrations/001_initial_schema.sql`
- [ ] **Add index on `prophecy_answers(player_id)`** — Queried per-player with no index. `supabase/migrations/001_initial_schema.sql`
- [ ] **Add composite index on `score_cache_trio_detail(player_id, group_id)`** — Common query pattern has no supporting index.
- [ ] **Add composite index on `group_members(group_id, user_id)`** — RLS policies join on this frequently.
- [ ] **Add CHECK constraint: is_active vs final_placement** — No constraint prevents `is_active = true` with a `final_placement` set. Commissioner could accidentally create inconsistent castaway state. `supabase/migrations/001_initial_schema.sql:62-75`

### TypeScript & Type Safety

- [ ] **Remove `any` type in useLeaderboard** — `(m: any) => m.user_id` should be properly typed from the group_members table response. `src/hooks/useLeaderboard.ts:74`
- [ ] **Replace unsafe `as` assertions in useAllPicks** — `as Pick<Profile, ...>[]` bypasses type checking. Use proper type guards or Zod parsing. `src/hooks/useAllPicks.ts:36`
- [ ] **Handle undefined score in leaderboard mapping** — `finalScores.find()` could return undefined, but code assumes it always exists. Add null coalescing. `src/hooks/useLeaderboard.ts:99-101`

### Error Handling

- [ ] **Fix silent error in useLeaderboard** — Returns early on error without setting `isLoading = false`, leaving UI in a permanent loading state. `src/hooks/useLeaderboard.ts:72`
- [ ] **Fix silent error in useBioQuestions** — Returns `[]` on error, indistinguishable from "no questions". `src/hooks/useBioQuestions.ts:15`
- [ ] **Add error handling to useAuth profile fetch** — If query fails, `data` is null and user sees a blank screen. No error state is exposed. `src/hooks/useAuth.ts:39-63`
- [ ] **Add try-catch to useActiveGroup** — Optimistic state update has no revert on failure.
- [ ] **Expose error states consistently across hooks** — Some hooks throw (useCreateGroup, useJoinGroup), some return empty arrays (useBioQuestions), some silently drop errors (useLeaderboard). Standardize the pattern.

### Data Fetching

- [ ] **Separate prophecy_outcomes into its own query** — Global data (not per-player) is re-fetched every time `['my-picks', userId, groupId]` is invalidated. Give it its own cache key. `src/hooks/useMyPicks.ts`
- [ ] **Scope query invalidation on auth change** — `queryClient.invalidateQueries()` invalidates everything including castaways and tribe colors which don't depend on the authenticated user. `src/hooks/useAuth.ts:29`
- [ ] **Scope Realtime profile subscription** — Profile updates from any user trigger a leaderboard re-fetch. Filter to group members only. `src/hooks/useLeaderboard.ts:124-136`
- [ ] **Use query key factories for group-scoped data** — Leaderboard, picks, and scores use generic keys like `['leaderboard']`. Should be `['leaderboard', groupId]` to avoid cross-group cache pollution when switching groups.
- [x] **Migrate useEpisodeSeenStatus to TanStack Query** — ~~Uses manual `useState` instead of `useQuery`.~~ Rewritten with `useQuery` + `useMutation`, optimistic updates, and automatic rollback. Also fixes stuck `isLoading` state that blocked the leaderboard.

### Memoization

- [ ] **Memoize `useCastawaysByTribe` derived data** — Rebuilds `byTribe` object on every hook call. Use `useMemo()` to avoid unnecessary recalculation.

### Cleanup

- [ ] **Remove backward-compat TODO in migration 009** — Score cache RLS has a TODO about removing old `using(true)` policy once all users are on the new app version. `supabase/migrations/009_multi_group.sql:231`
- [ ] **Use nested episode data from castaway_events** — Edge Function fetches `episodes(episode_number)` nested in events but then rebuilds an episode number map from a separate query. Use the nested data directly. `supabase/functions/calculate-scores/index.ts:154-169`

---

## UI/UX Enhancements

### Error States & Feedback

- [ ] **Add error boundary component** — No error boundaries anywhere in the app. React Native crashes show bare error screens with no recovery path.
- [ ] **Show error toasts on mutation failures** — Profile updates, episode marking, group operations all fail silently. Add a toast/snackbar system.
- [ ] **Distinguish RLS 403 errors from network errors** — When RLS rejects a query, users see generic errors. Surface "permission denied" clearly.

### Loading & Empty States

- [ ] **Add contextual loading messages** — Several screens show a bare `ActivityIndicator` with no text explaining what's loading.
- [ ] **Add empty state for castaways list** — No UI when castaway data is empty or still loading. `app/(tabs)/castaways.tsx`
- [ ] **Add empty state for leaderboard before first scoring** — New players see nothing until commissioner runs calculate-scores.

### Accessibility

- [ ] **Add `accessibilityLabel` to interactive elements** — No accessibility labels on buttons, links, or interactive components throughout the app.
- [ ] **Add `accessibilityRole` to semantic elements** — Missing role attributes for screen readers.
- [ ] **Supplement color-only information with text** — Rank colors and tribe colors convey meaning through color alone. Add text labels or icons as alternatives.

### Interaction Quality

- [ ] **Debounce profile "Save Name" button** — Users can click rapidly and trigger multiple concurrent update requests. `app/(tabs)/profile.tsx`
- [ ] **Add confirmation dialog for destructive actions** — Leaving a group has no confirmation. Consider adding one for irreversible actions.
- [ ] **Add pull-to-refresh on leaderboard** — Standard iOS pattern for refreshing data.

---

## Other

### Environment & Developer Experience

- [ ] **Add `.env.example` file** — No template for required environment variables. New developers have to read CLAUDE.md to know what's needed.
- [ ] **Graceful env var failure** — Supabase client throws during module load if env vars are missing, crashing the app before any UI renders. Show a developer-friendly error screen instead. `src/lib/supabase.ts:4-9`

### Data Integrity

- [ ] **Add trigger to auto-create score_cache row on pick submission** — New players have no score_cache entry until commissioner manually runs calculate-scores. A trigger could insert a zeroed-out row automatically.
- [ ] **Review CASCADE delete on groups** — Deleting a group cascades to group_members, score_cache, and score_cache_trio_detail. Consider `ON DELETE RESTRICT` to prevent accidental data loss. `supabase/migrations/009_multi_group.sql:28,133,136`

### Monitoring

- [ ] **Add structured error logging** — No Sentry, DataDog, or similar. Edge Function errors are only `console.error`. Critical for production debugging.
- [ ] **Add analytics/event tracking** — No visibility into user behavior: which screens are visited, how often scores are checked, pick submission funnel completion.

### Documentation

- [ ] **Document score calculation flow** — Complex multi-step process (events -> survival points -> placement inference -> trio/icky/prophecy scoring -> snapshots) has no architecture doc.
- [ ] **Document spoiler protection implementation** — Episode seen status, score snapshots, and snapshot fallback logic are spread across multiple files with no overview.
- [ ] **Add JSDoc to Edge Functions** — Parameter types, return values, and authorization requirements are undocumented.

### Future-Proofing

- [ ] **Create stored procedure for atomic pick submission** — Combine picks insert + conditional lock in one DB call to prevent race conditions.
- [ ] **Consider a materialized view for leaderboard** — Ranking logic in `sortAndRankScores()` is computed client-side. A DB view could centralize this and improve performance.
