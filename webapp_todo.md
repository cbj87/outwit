# Web App → iPhone App Feature Gaps

## Critical Missing Flows
- [ ] Pick Submission — no `/picks/submit` page (skipping for now: all picks already submitted this season)
- [ ] Group Management — no create/join/settings pages (skipping for now: all players already in groups)

## Infrastructure
- [x] PWA manifest — "Add to Home Screen" support (icons, apple-touch-icon, manifest.json fixed)

## Leaderboard
- [x] Group switcher — dropdown to switch between groups (already working)
- [x] Spoiler protection banner — interactive "I've seen it" / "Catch up" button with mark-as-seen mutations
- [x] Episode Detail page (`/episodes/[id]`) — full recap with event-by-event breakdown
- [x] Episodes List page (`/episodes`) — index of all finalized episodes

## Standalone Pages
- [ ] Prophecy Status page (`/prophecy/status`) — all 16 questions with YES/NO outcomes and pending state
- [ ] Scoring Rules page (`/scoring-rules`) — reference page for point values
- [ ] Group Settings page (`/groups/[id]/settings`) — rename group, manage members, leave group
