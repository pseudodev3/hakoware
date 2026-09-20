# Hakoware Project Handoff

> **Read this first when continuing Hakoware in a new chat.**
>
> Repo: `pseudodev3/hakoware`  
> Frontend: `https://hakoware.vercel.app`  
> Backend: Railway service `joyful-clarity - hakoware`  
> Database: MongoDB  
> Transactional email: Brevo  
> Last updated: **2026-09-20**
>
> Current `main`: **`27705fa87d5c042bee540bfac31ba02aeb01a9c6`**
>
> Current in-progress branch: **`ux/interaction-smoothness-pass`**
>
> Fast safe resume prompt:
>
> **Read `HANDOFF.md`, inspect current `main` and `ux/interaction-smoothness-pass`, then continue from the in-progress branch. Do not open a PR until the interaction pass is finished. Do not assume frontend changes are live unless Vercel succeeds or the user verifies them on-device.**

## 1. Exact current state

### Main

Current `main` is:

`27705fa87d5c042bee540bfac31ba02aeb01a9c6`

Recent important merges:

- PR #57 - **Make Wanted a real Arena bounty state**
  - merged as `e176c7399c4d85f43f3afe057193b0c59101b094`
- PR #59 - **Harden Hakoware server request and upload handling**
  - merged as `ec305046cef29cb80ccccc84d2dd9cdb494dff46`
- PR #58 - **Add priority notification emails and clean Home CTA**
  - merged as `27705fa87d5c042bee540bfac31ba02aeb01a9c6`

Deployment status for current `main` at handoff time:

- Railway backend: **success**
- Vercel: **blocked by free-tier build-rate-limit**
- Vercel failure is quota-related, not a code/build failure

The user manually verified the Wanted production deployment before the later security/email merges and confirmed it was working.

### In-progress branch

Branch:

`ux/interaction-smoothness-pass`

At handoff time it is:

- ahead of `main`
- not behind `main`
- **no PR opened yet**
- intentionally still in progress because the user wants PRs opened only when work is finished, to conserve Vercel build quota

Files currently changed on this branch:

- `src/App.jsx`
- `src/features/notifications/components/NotificationsPanel.jsx`
- `src/features/notifications/components/NotificationsPanel.css`
- `src/shared/components/Layout.css`

Current interaction-pass work already applied:

- notification actions are optimistic instead of waiting for refetch before UI changes
- notification rows animate/reflow subtly on read/delete
- **Mark all read** is visible on mobile instead of being hidden below 640px
- bulk-read action gets clear progress state
- authenticated Home / Contracts / Arena / You tab changes use a very light entry transition
- sidebar/mobile-nav active icons/indicators get subtle motion
- scroll container gets better touch/overscroll behavior

The pass is **not finished/audited yet**. Continue from this branch, inspect the exact diff, and finish the interaction-quality pass before opening a PR.

## 2. Current product priority

The user explicitly wants to improve **UX, clarity, responsiveness, and smoothness now rather than adding new mechanics**.

Current concern from real use:

> Hakoware looks much better, but some interactions still feel static or abrupt rather than buttery smooth.

Do **not** respond to this by adding decorative animation everywhere.

The desired direction is:

- continuity between states;
- immediate feedback after taps;
- subtle transitions when content changes;
- smooth panel/list/modal behavior;
- polished pressed/active states;
- fewer hard cuts;
- no overanimation;
- respect reduced-motion preferences.

Current strategic focus:

1. interaction quality / microinteractions;
2. first-duo activation and onboarding clarity;
3. evidence-led UX fixes from actual iPhone use;
4. reduce friction/confusion before adding more systems.

A useful activation metric to watch later:

**account created → first accepted contract → first mutual check-in**

## 3. Product identity

Hakoware is a **social-chaos game built around real relationships and recurring contracts**.

It is not a task manager, CRM, habit dashboard, crypto app, or generic SaaS product.

Core principle:

**Relationships dominate. Systems recede.**

Hierarchy should usually be:

**person → what is happening → what matters now → action**

Signed-in areas:

- Home
- Contracts
- Arena
- You

Founder tooling:

- `/founder`

## 4. UI direction

The signed-in UI has already gone through a substantial cleanup.

Keep:

- strong typography;
- restrained depth;
- subtle borders/dividers;
- lightweight icons;
- dark/gold/red/green Hakoware palette;
- mobile-first layout;
- meaningful state color;
- real game-item presentation where appropriate;
- intentional motion only.

Avoid:

- card soup;
- nested cards;
- KPI strips;
- generic SaaS dashboard treatment;
- giant status pills;
- excessive glows;
- heavy icons;
- unnecessary decoration;
- boxes around ordinary information;
- animation for animation's sake.

Exceptional states may be visually stronger:

- bankruptcy;
- Wanted / Most Wanted;
- live Chaos;
- bounty proof;
- destructive actions;
- security/sync errors;
- season completion.

### UI skills

For substantial Hakoware UI work, consult:

- `jakubkrehel/skills` → `better-ui`
- `emilkowalski/skills` → `emil-design-eng`

Also use better-layout / better-typography guidance when appropriate.

Do not claim they are installed unless the environment confirms it. Reading the skill files directly is acceptable.

## 5. Voice / copy

Canonical voice guide:

`docs/VOICE.md`

Rule:

**State first. Action second. Explanation only when needed.**

Copy should be:

- short;
- specific;
- confident;
- slightly mischievous;
- never corporate;
- never tutorial-heavy.

Do not over-compress high-stakes copy such as:

- bankruptcy/recovery;
- bounty hunter credit;
- Claim / Return the Favor;
- Aura spending;
- destructive actions;
- security/sync errors.

## 6. Home / You current design state

A Product Design prototype was translated into production and merged earlier.

Home:

- relationships dominate immediately;
- contract cards are the repeated object;
- system metadata is quieter;
- duplicate bottom **Grow the circle / New contract** CTA has now been removed;
- primary Home header **New** action remains.

You:

- Profile + Aura form one coherent top area;
- Hakoware+ is a premium destination, not a settings row;
- Aura Market feels like an in-game market;
- Inventory / Grudges / Privacy / Aura Ledger / Account visually recede;
- Aura item art uses a permanent dark mini-stage so light mode does not expose pale gutters.

Do not redesign these surfaces from scratch unless a real usability problem is observed.

## 7. Contract cards

Approved card anatomy:

**identity → state → context → Duo → actions**

Keep:

- true card shell;
- text-only status eyebrow;
- lightweight icons;
- 3-dot overflow;
- state hero;
- meta line;
- slim Duo XP meter;
- quiet Report + secondary + gold primary.

Avoid:

- identity rail;
- nested boxed status areas;
- status dots/pills;
- excessive state ornament.

Orbit motif exists only as a subtle theme layer and was deliberately quieted after testing.

Current user reaction: contract cards are acceptable now; do not churn them aesthetically without a concrete reason.

## 8. Core contract modes

Templates:

- `DONT_GHOST`
- `GYM_PACT`
- `STUDY_ARC`
- `LOCK_IN`
- `LONG_DISTANCE`
- `BUILD_IN_PUBLIC`
- `CHAOS`
- `CUSTOM`

Typical seasons are 30 days.

Long Distance typically uses 45 days.

Duo progression:

`level = floor(sqrt(xp / 50)) + 1`

Check-in cadence:

- one valid check-in every 20h per side

Base XP:

- text +10
- voice +15

## 9. Bankruptcy / recovery

Authoritative logic lives in:

`server/services/debtState.js`

Bankruptcy threshold:

`total debt >= limit * 2`

Recovery:

**BANKRUPT → RECOVERING → STABLE**

Normal contract debt/grace continues independently of Chaos anomalies unless a specific mechanic says otherwise.

## 10. Wanted / Most Wanted / Arena bounty loop

This section replaces the old handoff description that said Wanted was only a 48h label.

### Failed Chaos anomaly

When a targeted Chaos anomaly fails:

- the anomaly consequence applies;
- Wanted begins;
- Hakoware automatically creates a **system Chaos bounty**;
- no new Chaos anomaly can start while Wanted is unresolved;
- normal contract debt continues underneath.

Automatic bounty by Chaos level:

- Lv1 → 25 Aura
- Lv2 → 35 Aura
- Lv3 → 50 Aura
- Lv4 → 70 Aura
- Lv5 → 100 Aura

### Wanted

Wanted gives a 48h escape window.

The target remains allowed to check in.

Check-in is the counterplay and settlement action.

The contract partner **cannot hunt** the automatic system Wanted bounty.

Eligible outside Arena players can hunt it.

### Most Wanted

If the wanted target still has not checked in after the 48h Wanted window:

- state derives to **Most Wanted**;
- the bounty remains public/huntable;
- normal debt continues rising;
- Wanted does not simply disappear.

### Wanted + bankruptcy

If the target becomes bankrupt while Wanted/Most Wanted:

- do **not** create a second overlapping bounty;
- the same bounty remains;
- the contract partner can add Aura to that bounty;
- Arena shows one combined total and the funding breakdown.

Example:

`130 Aura`  
`50 Chaos + 80 Partner`

Combined bounty cap remains 500 Aura.

### Settlement economics

System and partner funding are tracked separately.

If hunter pressure is credited:

- hunter receives the combined total.

If target escapes/checks in without hunter credit:

- system Chaos Aura closes;
- only partner-funded Aura is refundable;
- Hunter Bond follows the existing settlement rules.

Clean Slate can clear bankruptcy state but does **not** erase unresolved Wanted.

Chaos Ticket cannot be consumed while Wanted is unresolved.

Legacy Wanted states are backfilled from the latest `CHAOS_FAILED` event so pre-feature Wanted contracts can enter the new system.

## 11. Existing bounty / Claim / Grudge mechanics

Normal bankruptcy bounty:

- bankruptcy unlocks partner bounty placement;
- amount 10–500 Aura;
- reward escrowed;
- listing fee applies;
- hunter stakes bond;
- hunter sends pressure;
- target credits or escapes.

Claim:

- cost 180 Aura;
- bankrupt partner only;
- steals 10% of current Aura;
- once per bankruptcy window;
- creates 7-day Grudge.

Return the Favor:

- cost 60 Aura;
- if original claimant later becomes bankrupt during active Grudge;
- steals 10% of claimant's current Aura;
- settles Grudge.

## 12. Aura cards

Current cards:

- Clean Slate / PURIFY → 120 Aura
- Claim / STEAL → 180 Aura
- Signal Flare → 45 Aura
- Chaos Ticket → 90 Aura

Aura is in-app game currency, not crypto in this Hakoware version.

## 13. Notifications

The panel is intentionally flatter and compact.

Current architecture already had:

- individual Mark read;
- Delete;
- backend `PUT /notifications/read-all`;
- frontend `markAllNotificationsAsRead()`;
- a header **Mark all read** control.

Important bug discovered on 2026-09-20:

The mobile CSS explicitly hid the bulk-read button:

`.mark-all-btn { display:none; }`

inside `@media (max-width:640px)`.

The current in-progress interaction branch fixes this and keeps Mark all read visible on iPhone.

The branch also makes notification actions optimistic so Mark read/Delete/Mark all read feel immediate instead of waiting for a network refetch.

Do not re-expand notifications into large activity cards.

## 14. Priority email notifications

Merged on current `main`.

High-priority in-app notifications can also send email for:

- Chaos anomaly detected;
- Chaos failed / Wanted;
- bankruptcy;
- bounty placed or boosted;
- hunter assigned;
- hunter pressure;
- Signal Flare;
- Claim received;
- Return the Favor received.

Rules:

- in-app notification remains source of truth;
- email failures do not fail gameplay;
- `notificationPreferences.email = false` is respected;
- bankruptcy warning preference is respected;
- Founder Lab/test accounts are skipped;
- routine check-ins, refunds, ordinary rewards, recaps, etc. remain in-app only.

## 15. Server security baseline

The server-side hardening pass is merged.

Current protections include:

- env files ignored;
- server-side authorization checks;
- client payload minimization;
- exact CORS + narrow Hakoware Vercel preview regex;
- CSP/security headers;
- `authVersion` session revocation;
- founder allowlist fail-closed;
- generic forgot-password response;
- fragment reset links;
- private voice storage;
- MIME whitelist;
- request body size limits;
- rate limiting.

Newer hardening from PR #59:

### Safe error responses

Unexpected route failures no longer return arbitrary internal `err.message` / `error.message`.

Intentional 4xx gameplay/business errors can still preserve their messages.

### Request guard

Global request guard rejects:

- Mongo operator keys beginning with `$`;
- dotted object keys;
- `__proto__`;
- `constructor`;
- `prototype`;
- excessive nesting;
- excessive field count.

### Voice magic-byte validation

Voice uploads validate actual file signatures for accepted types:

- WebM
- MP4/M4A
- MP3
- Ogg
- WAV
- AAC/ADTS

MIME alone is no longer trusted.

### Rate limiter

Current limiter remains dependency-free/in-memory for Railway free-tier simplicity.

It now:

- hashes limiter keys;
- caps active buckets;
- fails closed if storage saturates;
- adds account-targeted login throttling in addition to IP throttling.

Known limitation:

- limiter is process-local;
- if Hakoware later runs multiple API replicas, move rate limiting to shared storage.

Regression script:

`server/scripts/checkServerHardening.js`

npm script:

`check:server-hardening`

## 16. Founder Lab

Founder access is controlled through `FOUNDER_EMAILS`.

Founder Lab:

- disposable test users;
- real test contracts;
- force Clear / Ready / Overdue / Bankrupt;
- exact Chaos events;
- test Aura;
- season completion;
- impersonation.

Sandbox rules must remain:

- test bounties stay out of live Arena;
- test Grudges/Shame stay isolated;
- test/live users cannot cross-hunt;
- cleanup removes disposable test data.

Do not send priority emails to test accounts.

## 17. Auth architecture caveat

Signed-in JWT remains JS-accessible/localStorage + `x-auth-token` by design because Founder impersonation currently depends on this architecture.

Do not casually migrate to HttpOnly cookies during unrelated work.

That is a separate higher-blast-radius project.

## 18. Deployment / quota constraints

The user is trying to conserve free-tier build/deployment limits.

### GitHub Actions

Monthly Actions quota was exhausted.

Do not rely on Actions as the validation gate until quota resets.

### Vercel

Free-tier build-rate-limit has been hit repeatedly.

A Vercel status of failure pointing to the build-rate-limit/upgrade page is **not** evidence of a code failure.

### Railway

Railway free tier is being conserved.

Do not introduce extra staging/preview services unless the user explicitly wants that cost/complexity.

### PR discipline

The user explicitly asked:

**Do not open a PR until the work is finished.**

For UI/UX passes:

1. finish the branch;
2. inspect exact diff;
3. syntax/static audit;
4. then open one PR;
5. merge only after review.

## 19. Real-device QA

The user primarily tests on iPhone.

Real iPhone screenshots are an important UX signal.

Past issues found through device testing:

- iOS/Brave input auto-zoom;
- notification bulk action hidden on mobile;
- overly large notification cards;
- incoming invites below the fold;
- misleading immediate check-in CTA;
- Season Event card feeling vibe-coded;
- excessive boxes/glows/pills;
- Aura Market artwork gutters in light mode.

Do not claim device behavior without user verification or real runtime evidence.

## 20. Current product risks / strategic notes

Hakoware now has many mechanics:

- contracts;
- Duo XP;
- debt;
- bankruptcy;
- recovery;
- Aura;
- cards;
- Chaos;
- anomalies;
- Wanted;
- Most Wanted;
- bounties;
- Hunter Bonds;
- pressure;
- Grudges;
- Claim;
- Return the Favor;
- weekly/world rules;
- Arena;
- Hakoware+.

Do not solve UX problems by adding more mechanics.

The main UX challenge now is progressive disclosure:

New user should first understand:

**pick someone → make a contract → check in → do not disappear**

Then deeper systems can reveal themselves through play.

Arena/Chaos/etc. should feel discovered, not explained all at once.

## 21. Engineering workflow

For repo changes:

1. inspect current `main`;
2. inspect any active feature branch before creating another;
3. keep changes focused;
4. preserve working mechanics;
5. do not use GitHub Actions while quota is exhausted;
6. run local/static/syntax checks available through repo inspection;
7. inspect exact diff;
8. open one PR only when finished;
9. review exact PR head;
10. squash merge;
11. check exact merged commit deployment status;
12. do not call something live until deployment confirms it or user verifies it.

## 22. Immediate next task

**Continue `ux/interaction-smoothness-pass`.**

Do not start a second UX branch.

Current intended scope:

- finish notification microinteraction polish;
- ensure Mark all read is clearly usable on iPhone;
- keep optimistic notification actions robust;
- audit the light tab transition;
- inspect existing modal/panel transitions for abrupt or duplicated animation;
- improve touch/pressed feedback only where interactions genuinely feel dead;
- preserve reduced-motion behavior;
- avoid animation bloat;
- do a final mobile-first interaction audit;
- inspect exact diff;
- only then open one PR.

The user described the goal as:

**make Hakoware feel more buttery smooth and less static, without redesigning it or adding new mechanics.**

## 23. Resume checklist

When starting a new chat:

1. read this file;
2. inspect current `main` at/after `27705fa87d5c042bee540bfac31ba02aeb01a9c6`;
3. inspect `ux/interaction-smoothness-pass`;
4. continue that branch rather than starting over;
5. do not open a PR until the interaction pass is finished;
6. remember Vercel build-rate failures may be quota-only;
7. preserve the current product hierarchy and mechanics;
8. use Better UI + Emil Design Engineering principles for UI work;
9. keep motion restrained and purposeful;
10. prioritize first-duo UX and real iPhone feedback over adding systems.
