# Outwit Open — Claude Code Context

## Project Overview
Outwit Open is a React Native (Expo) iOS app for a 12-player fantasy Survivor
league for Season 50. Players submit pre-season picks, and the commissioner
(Lizzie) logs episode events in-app after each week. The app calculates live standings.

## Tech Stack
- React Native + Expo SDK ~53
- Expo Router (file-based routing)
- TypeScript (strict)
- Supabase (auth, Postgres, Realtime, Edge Functions)
- TanStack Query (data fetching/caching)
- Zustand (auth state)
- Zod (validation)

## Key Architecture Rules
- Scoring runs server-side in the `calculate-scores` Edge Function only. Never
  compute final scores client-side.
- `score_cache` stores pre-computed scores. Leaderboard reads from this table.
- `season_config` is a single-row table (id = 1 enforced by CHECK constraint).
- Picks are locked when `picks.is_locked = true` OR deadline has passed. Check both.
- `is_commissioner = true` is set manually in Supabase dashboard — no in-app flow.
- Admin tab renders `null` for non-commissioners (not hidden, actually absent).
- Supabase client must have `detectSessionInUrl: false` and use `AsyncStorage`.

## People
Fantasy players (12): Annie, Bre, Chad, Cam, Chase, Cole, Hannah, Jenna, Kaylin,
                       Lizzie (commissioner), Scott, Taylor
Castaways — VATU: Colby, Genevieve, Rizzo, Angelina, Q, Stephenie, Kyle, Aubry
            CILA: Joe, Savannah, Christian, Cirie, Ozzy, Emily, Rick, Jenna
            KALO: Jonathan, Dee, Mike, Kamilla, Charlie, Tiffany, Coach, Chrissy
NOTE: Fantasy player "Jenna" ≠ castaway "Jenna" (CILA tribe).

## Environment Variables
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Edge Functions only — never expose client-side

## Key Files
- src/lib/constants.ts          — canonical EVENT_SCORES map and scoring config
- src/lib/supabase.ts           — Supabase client singleton
- src/lib/scoring.ts            — pure scoring functions (shared logic with Edge Function)
- src/types/index.ts            — all TypeScript interfaces
- src/store/authStore.ts        — Zustand auth store
- supabase/functions/calculate-scores/index.ts — server-side scoring
- supabase/migrations/          — all DB schema, RLS, seed data

## Scoring Summary
Three components per player:
1. Trusted Trio (3 castaways) — sum of events + survival points per episode survived
2. Icky Pick (1 castaway) — points based on final placement only
3. Prophecy (16 yes/no) — correct answer earns listed points, wrong = 0

Tie-break order: Total → Trio → Prophecy → Icky → Alphabetical

See src/lib/constants.ts for all point values.

## Scoring Constants
### Trusted Trio Event Points
| Event | Points |
|---|---|
| idol_found | +5 |
| advantage_found | +4 |
| idol_played_correct | +8 |
| idol_played_incorrect | -3 |
| shot_in_dark_success | +6 |
| shot_in_dark_fail | -5 |
| fire_making_win | +10 |
| individual_immunity_win | +6 |
| individual_reward_win | +3 |
| final_immunity_win | +12 |
| made_jury | +5 |
| placed_3rd | +20 |
| placed_runner_up | +25 |
| sole_survivor | +40 |
| first_boot | -25 |
| voted_out_with_idol | -12 |
| voted_out_with_advantage | -10 |
| voted_out_unanimously | -5 |
| quit | -25 |

### Survival Points (per episode survived, per castaway in trio)
| Episodes | Points/ep |
|---|---|
| 1–3 | 1 |
| 4–6 | 2 |
| 7–9 | 3 |
| 10–12 | 5 |
| Final 5 | 7 |
| Final 4 | 10 |

### Icky Pick (based on final placement)
| Placement | Points |
|---|---|
| first_boot | +15 |
| pre_merge | +8 |
| jury | -8 |
| 3rd | -15 |
| winner | -25 |

### Prophecy Points (correct answer only)
Q1–Q3: 1pt | Q4–Q7: 2pt | Q8–Q9: 3pt | Q10–Q16: 4pt

## Project Structure
```
outwit/
├── CLAUDE.md
├── app.json
├── eas.json
├── tsconfig.json
├── .env.local          (gitignored)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_seed_castaways.sql
│   │   └── 004_seed_prophecy.sql
│   └── functions/
│       ├── calculate-scores/index.ts
│       └── lock-picks/index.ts
└── src/
    ├── app/            (Expo Router file-based routing)
    │   ├── _layout.tsx         (root auth gate)
    │   ├── (auth)/sign-in.tsx
    │   ├── (auth)/sign-up.tsx
    │   ├── (tabs)/_layout.tsx  (bottom tabs)
    │   ├── (tabs)/index.tsx    (leaderboard)
    │   ├── (tabs)/my-picks.tsx
    │   ├── (tabs)/castaways.tsx
    │   ├── (tabs)/admin.tsx    (commissioner only)
    │   ├── picks/submit.tsx    (multi-step pick flow)
    │   ├── castaways/[id].tsx
    │   └── admin/episode.tsx, prophecy.tsx, reveal.tsx
    ├── components/
    │   ├── ui/
    │   ├── leaderboard/
    │   ├── picks/
    │   ├── castaways/
    │   └── admin/
    ├── hooks/
    ├── lib/
    │   ├── supabase.ts
    │   ├── scoring.ts
    │   ├── constants.ts
    │   ├── notifications.ts
    │   └── validation.ts
    ├── store/authStore.ts
    ├── types/index.ts
    └── theme/colors.ts
```

## Dev Commands
```bash
# Source nvm first on this machine
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

npx expo start --ios          # Start dev server + iOS simulator
npx supabase start            # Start local Supabase (Docker required)
npx supabase db reset         # Reset local DB + run all migrations
npx supabase functions serve  # Serve Edge Functions locally
npx expo build:ios            # EAS build for iOS
```

## Gotchas
- **nvm**: Node is managed via nvm on this machine. Source nvm before any node/npm/npx commands.
- **Apple sign-in**: Requires physical device + Apple Developer account + entitlements. Cannot test in simulator.
- **Google sign-in**: Requires `@react-native-google-signin/google-signin` (not yet installed — add in Phase 6).
- **Supabase Realtime**: Requires `REPLICA IDENTITY FULL` on tables you subscribe to (`score_cache`, `season_config`).
- **React Native**: Never use browser globals (`window`, `document`, `localStorage`).
- **AsyncStorage**: Required for Supabase session persistence in React Native.
- **detectSessionInUrl**: Must be `false` in Supabase client config for React Native.
- **Admin tab**: Renders `null` for non-commissioners — not just hidden. Keeps tab bar to 3 items for regular players.
- **Picks locking**: Check BOTH `picks.is_locked = true` AND `now() > season_config.picks_deadline`.
- **Commissioner setup**: Set `is_commissioner = true` in Supabase dashboard for Lizzie's profile row. No in-app flow.
