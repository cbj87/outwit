# Outwit Web App Plan

## Context

The existing Outwit app is an iOS-only React Native/Expo app. The goal is to add a web-accessible version of the app that lives in the same repo, uses the same Supabase backend, and can be worked on in small independent steps without touching or risking the iOS app.

**Approach:** Add a Next.js 15 web app in a `web/` subdirectory. It will share the existing `src/types/`, `src/lib/constants.ts`, `src/lib/scoring.ts`, and `src/lib/validation.ts` files directly via TypeScript path aliases (no duplication). The iOS app remains completely untouched.

**Why not Expo Web?**
The iOS app uses `NativeTabs` (iOS-only), `expo-apple-authentication`, `expo-haptics`, `expo-glass-effect`, and `expo-notifications` — none of which work on web. Wrapping those with conditionals would make the iOS codebase messy and fragile. A standalone Next.js app in `web/` is clean and risk-free.

---

## Shared Code (no changes needed)

These files can be imported directly by the web app:
- `src/types/index.ts` — all TypeScript interfaces
- `src/lib/constants.ts` — EVENT_SCORES, ICKY_PICK_SCORES, PROPHECY_POINTS, etc.
- `src/lib/scoring.ts` — pure scoring functions
- `src/lib/validation.ts` — Zod schemas

---

## Tech Stack (Web)

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 |
| Data fetching | TanStack Query v5 (same as iOS) |
| Auth state | Zustand (same pattern as iOS) |
| Supabase | @supabase/ssr (cookie-based sessions for Next.js) |
| Deployment | Vercel |

---

## Steps

### Phase 1 — Project Setup

- [x] **Step 1: Scaffold `web/` Next.js app**
  - Run `npx create-next-app@latest web` with App Router + TypeScript + Tailwind
  - Add to root `.gitignore` entries: `web/.next`, `web/node_modules`
  - Keep `web/package.json` separate (not a monorepo)

- [ ] **Step 2: Configure shared code access**
  - In `web/tsconfig.json`, add path alias: `"@shared/*": ["../src/*"]`
  - This lets web app import from `@shared/types`, `@shared/lib/constants`, etc.
  - In `web/next.config.ts`, set `transpilePackages` if needed for the shared path

- [x] **Step 3: Set up Supabase client for web**
  - Install `@supabase/ssr` and `@supabase/supabase-js` in `web/`
  - Create `web/lib/supabase/client.ts` — browser client using cookies (not AsyncStorage)
  - Create `web/lib/supabase/server.ts` — server-side client for RSC and middleware
  - Create `web/middleware.ts` — refresh session on every request
  - Add `.env.local` in `web/` (same SUPABASE_URL and ANON_KEY values)

- [x] **Step 4: Set up auth store**
  - Create `web/store/authStore.ts` mirroring the iOS Zustand store
  - Handles session, profile, activeGroup, isCommissioner, isGroupCommissioner

---

### Phase 2 — Authentication

- [x] **Step 5: Sign-in page**
  - `web/app/(auth)/sign-in/page.tsx`
  - Email + password form → Supabase `signInWithPassword`
  - Redirect to `/` on success

- [x] **Step 6: Sign-up page**
  - `web/app/(auth)/sign-up/page.tsx`
  - Email + password + display name → Supabase `signUp`
  - Note: no Apple Sign-In on web (email only for now)

- [ ] **Step 7: Auth middleware + protected routes**
  - `web/middleware.ts` — redirect to `/sign-in` if no session
  - Public routes: `/sign-in`, `/sign-up`
  - All other routes require auth

---

### Phase 3 — Core Read-Only Pages

- [ ] **Step 8: Leaderboard (home page)**
  - `web/app/(app)/page.tsx`
  - Mirrors `app/(tabs)/index.tsx`
  - Shows ranked player list with trio/icky/prophecy/total scores
  - Reads from `score_cache` via React Query
  - Respect spoiler protection (show score_snapshots for protected users)

- [ ] **Step 9: Castaways page**
  - `web/app/(app)/castaways/page.tsx`
  - Mirrors `app/(tabs)/castaways.tsx`
  - Grouped by tribe (VATU / CILA / KALO), shows who picked each castaway
  - Only shows picks if `picks_revealed = true` for the active group

- [ ] **Step 10: Castaway detail page**
  - `web/app/(app)/castaways/[id]/page.tsx`
  - Mirrors `app/castaways/[id].tsx`
  - Shows castaway info, event history, total points contributed

- [ ] **Step 11: My Picks page**
  - `web/app/(app)/my-picks/page.tsx`
  - Mirrors `app/(tabs)/my-picks.tsx`
  - Shows the current user's trio + icky pick + score breakdown
  - Shows prophecy answers and outcomes

---

### Phase 4 — Interactive Pages

- [ ] **Step 12: Picks submission**
  - `web/app/(app)/picks/submit/page.tsx`
  - Mirrors `app/picks/submit.tsx`
  - Multi-step: pick trio (3 castaways) → pick icky → submit
  - Disabled if `is_locked` or past deadline
  - Uses same Zod validation from `@shared/lib/validation`

- [ ] **Step 13: Prophecy answers submission**
  - `web/app/(app)/prophecy/page.tsx`
  - 16 yes/no questions from `prophecy_questions` table
  - Locked after picks deadline

- [ ] **Step 14: Profile page**
  - `web/app/(app)/profile/page.tsx`
  - Mirrors `app/(tabs)/profile.tsx`
  - Edit display name, avatar (upload to Supabase storage)
  - Survivor bio questionnaire
  - Toggle spoiler protection
  - Group management (view active group, join/create group)
  - Sign out

- [ ] **Step 15: Player detail page**
  - `web/app/(app)/player/[id]/page.tsx`
  - Mirrors `app/player/[id].tsx`
  - Shows another player's score breakdown

---

### Phase 5 — Group Management

- [ ] **Step 16: Create group**
  - `web/app/(app)/groups/create/page.tsx`
  - Form: group name, picks deadline

- [ ] **Step 17: Join group**
  - `web/app/(app)/groups/join/page.tsx`
  - Enter invite code → join group

---

### Phase 6 — Admin (Commissioner Only)

All admin pages check `is_commissioner` and return 404 for non-commissioners.

- [ ] **Step 18: Admin panel**
  - `web/app/(app)/admin/page.tsx`
  - Dashboard with links to episode logging, prophecy resolution, tribe management

- [ ] **Step 19: Log episode events**
  - `web/app/(app)/admin/episode/page.tsx`
  - Mirrors `app/admin/episode.tsx`
  - Select episode → select castaway → select event type → save
  - Calls `castaway_events` table insert

- [ ] **Step 20: Resolve prophecy outcomes**
  - `web/app/(app)/admin/prophecy/page.tsx`
  - Mirrors `app/admin/prophecy.tsx`
  - Mark each prophecy question true/false + which episode it resolved

- [ ] **Step 21: Calculate scores**
  - Button on admin panel that invokes the `calculate-scores` Edge Function
  - Same HTTP POST to the Edge Function URL (authenticated)

- [ ] **Step 22: Manage tribe assignments**
  - `web/app/(app)/admin/tribes/page.tsx`
  - Update current_tribe for castaways after tribe swaps/merges

---

### Phase 7 — Polish & Deploy

- [ ] **Step 23: Scoring rules page**
  - `web/app/(app)/scoring-rules/page.tsx`
  - Static page explaining the scoring system

- [ ] **Step 24: Navigation layout**
  - `web/app/(app)/layout.tsx`
  - Top nav bar with links: Leaderboard | My Picks | Castaways | Profile | Admin
  - Show/hide Admin link based on commissioner status

- [ ] **Step 25: Responsive design pass**
  - Ensure all pages look good on mobile browser, tablet, desktop
  - Tailwind responsive classes throughout

- [ ] **Step 26: Deploy to Vercel**
  - Connect `web/` subdirectory to a new Vercel project
  - Set environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
  - Configure `web/` as the root directory in Vercel settings

---

## Critical Files (iOS — do not modify)

- `app/` — all Expo Router routes
- `src/` — all React Native components, hooks, theme
- `supabase/` — migrations and edge functions (web shares these, no changes)

## Web File Structure (all new, in web/)

```
web/
├── app/
│   ├── (auth)/sign-in/page.tsx
│   ├── (auth)/sign-up/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              ← nav bar
│   │   ├── page.tsx                ← leaderboard
│   │   ├── castaways/page.tsx
│   │   ├── castaways/[id]/page.tsx
│   │   ├── my-picks/page.tsx
│   │   ├── picks/submit/page.tsx
│   │   ├── prophecy/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── player/[id]/page.tsx
│   │   ├── groups/create/page.tsx
│   │   ├── groups/join/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── admin/episode/page.tsx
│   │   ├── admin/prophecy/page.tsx
│   │   ├── admin/tribes/page.tsx
│   │   └── scoring-rules/page.tsx
│   └── layout.tsx                  ← root layout (providers)
├── lib/
│   ├── supabase/client.ts          ← browser supabase client
│   └── supabase/server.ts          ← server supabase client
├── store/
│   └── authStore.ts                ← zustand (mirrors iOS)
├── hooks/                          ← web versions of iOS hooks
├── middleware.ts                   ← session refresh + auth guard
├── tsconfig.json                   ← includes @shared/* alias
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── .env.local                      ← same Supabase keys (gitignored)
```

## Verification

After each step:
1. `cd web && npm run dev` — check the page renders
2. Sign in with a test account and verify data loads from Supabase
3. After Step 12, submit test picks and confirm they appear in the iOS app too
4. After Step 21, trigger score calculation and verify leaderboard updates on both web and iOS
