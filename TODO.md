# TODO

## New Features
- [ ] Add the ability to add games to custom slates
- [ ] Dark mode — define dark palette in `theme/colors.ts`, add toggle in profile settings
- [ ] Push notifications for episode finalization, picks locked, prophecy outcomes, score changes (`notifications.ts` only registers tokens today)
- [ ] Pick draft saves — persist in-progress picks so users don't lose work if they close the app mid-submission
- [ ] Pick history/revisions — store previous pick versions so players can see what they changed
- [ ] Score history graph — `score_snapshots` table is populated but never surfaced in the UI
- [ ] Per-episode scoring breakdown on leaderboard — tap a player to see episode-by-episode point changes
- [ ] Episode recap screen — flesh out `episodes/[id].tsx` with a narrative summary of events
- [ ] Invite code display/regeneration in group settings
- [ ] Group deadline editing from the UI (currently database-only)
- [ ] Undo/rollback for episode finalization (commissioner accidentally finalizes wrong data)
- [ ] Picks deadline countdown — show a "time remaining" indicator on the picks screen
- [ ] Season archive — store completed seasons for historical viewing

## Feature Enhancements
- [ ] Pull-to-refresh on all list screens (leaderboard, castaways, episodes) using `RefreshControl`
- [ ] Skeleton/shimmer loading states instead of plain `ActivityIndicator` spinners
- [ ] Error states with retry buttons — currently failed queries show spinners indefinitely
- [ ] Error boundaries on all screens to prevent full-app crashes
- [ ] Toast/snackbar notifications instead of `Alert` dialogs for non-critical feedback
- [ ] Haptic feedback on button taps (`expo-haptics` is installed but unused)
- [ ] Optimistic UI updates for pick submission and group switching
- [ ] Offline detection banner — show "No connection" state and queue retries
- [ ] Realtime subscription fallback — if Supabase Realtime disconnects silently, fall back to polling
- [ ] Accessibility labels (`accessibilityLabel`, `testID`) on all interactive elements
- [ ] Screen reader hints for complex components (leaderboard rows, episode breakdowns, emoji decorations)
- [ ] Episode validation — prevent logging Episode 5 before Episode 1, warn on conflicting events (e.g., voted out + immunity win same episode)
- [ ] Finale validation — ensure exactly 1 Sole Survivor, 1 runner-up, 1 third place before finalization
- [ ] Admin prophecy audit view — show who answered what for each question

## Code Cleanup
- [ ] Extract reusable `Glass` wrapper component — duplicated across 6+ screens
- [ ] Extract shared `Avatar` component — initials/image logic repeated 5+ times
- [ ] Extract `CastawayRow` component — similar markup in my-picks, player detail, castaways list
- [ ] Extract `SectionHeader` component — duplicated across my-picks and player detail
- [ ] Create shared `Button`, `Input`, `Badge` UI components for design consistency
- [ ] Remove `any` types (21 instances across hooks, scoring, admin, picks, groups)
- [ ] Fix `useLeaderboard` ref pattern — replace fragile `useRef` assignments with proper dependency arrays
- [ ] Add error handling to `useSeasonConfig` promise chain (currently swallows errors silently)
- [ ] Add `.catch()` to unhandled promise in `prophecy/status.tsx` `useEffect`
- [ ] Fix `useBioQuestions` — returns empty array on error, hiding failures from UI
- [ ] Define shared spacing/typography scale in `theme/` — currently ad-hoc mix of 8/12/14/16/32px
- [ ] Move inline `RANK_COLORS` and `AVATAR_COLORS` from `index.tsx` into `theme/colors.ts`
- [ ] Remove stale TODO comment in migration 009 (line 231) after cleanup
- [ ] Deduplicate scoring constants — `src/lib/constants.ts` and `calculate-scores` Edge Function have separate copies that could diverge
- [ ] Consistent error handling strategy — currently a mix of try-catch, `.catch()`, and conditional checks

## Testing & Monitoring
- [ ] Add unit tests for `src/lib/scoring.ts` pure functions
- [ ] Add unit tests for `src/lib/validation.ts` Zod schemas
- [ ] Add integration tests for Edge Functions (calculate-scores, lock-picks)
- [ ] Add E2E tests for critical flows (pick submission, episode logging, scoring)
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Add analytics for feature usage tracking

## Database
- [ ] Add index on `castaway_events.episode_id` (frequently filtered)
- [ ] Add index on `score_cache.group_id` (frequently filtered)
- [ ] Add CHECK constraint on episode numbers (prevent negative/zero)
- [ ] Add audit logging table for admin actions (who changed what, when)
