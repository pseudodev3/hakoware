# Social home polish — 2026-10-05

Reviewed the existing Home in the browser before editing. Kept Public Sans, the merged palette, real social state, three prioritized Home slots, and existing contract actions. The same friend-card component is used by Circle.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/features/friendship/components/FriendCard.jsx` | Small message beneath account identity; navigation indicated by a corner arrow | Person identity, real event time, readable preview, explicit Open / Start conversation | The friendship and conversation have a clear visual hierarchy |
| MEDIUM | `src/features/friendship/components/FriendCard.css` | Repeated green status dots and filled check-in blocks | Quiet Duo/state footer; separate 44px action; genuine update/danger borders | Controls and exceptional states earn emphasis; no implied online presence |
| MEDIUM | `src/features/friendship/components/FriendCard.jsx` | An old message could mask a newer check-in | Compare actual message/activity timestamps; omit invalid dates and clamp future clock differences | A fresh social update stays visible without inventing recency |
| MEDIUM | `src/features/friendship/components/FriendCard.jsx` | Navigation button lacked a clear accessible name; unavailable actions resembled completion | Person-specific name, described preview/update count, unavailable label without green check | Focus communicates destination and real update state |
| LOW | `src/features/friendship/components/FriendCard.css` | Unbounded long identity text | Two-line name, single-line handle, two-line preview; full accessible text retained | Short phones retain the hierarchy and reachable controls |
| LOW | `src/features/home/HomeView.jsx` | Generic New button, decorative tagline, no direct remaining-roster link | Add friend; Friends heading with Open circle / See all N | Action intent and access to the rest of the circle are clear |
| LOW | `src/features/home/HomeView.css`, `src/features/home/HomePlay.css` | Friend and play headings used different spacing | Shared section rhythm | Neighboring surfaces feel composed together |

Verification:

- Production build, full lint with zero errors, circle-activity checks, diff whitespace check and independent code review passed. Existing lint warnings and bundle-size warning remain.
- Browser fixtures passed Home/Circle at 320×844, 390×600, 390×844, and 1280×844; light/dark, reduced and normal motion. Screenshots were inspected in both themes, including long identity/recovery and the Circle roster.
- Checked actual font loading, overflow, 44px controls, conversation opening/return focus, keyboard activation, update descriptions, newer check-in versus old message, invalid/missing/future dates, empty conversations, broken avatars, long names/messages, recovery, completed-season Recap, missing perspective, open/waiting moments, shared payoff and See all routing.
- Existing revamp interactions passed: collection filters and lost purchase-response retry, five destinations, wall Add/Browse sheets, Activity focus restoration, exact incoming-offer routing and empty-circle discovery.
- Not verified: physical iPhone/Safari, live account conversations/voice storage, or live two-account trades. Browser API fixtures establish UI behavior only.

Approve: no HIGH findings remain in the inspected scope.
