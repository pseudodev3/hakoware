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
> Safe resume prompt:
>
> **Read `HANDOFF.md`, inspect current `main`, then continue Hakoware from there. Do not assume a merged change is live until the exact deployment status or device behavior is verified.**

## 1. Product in one sentence

Hakoware is a **social-chaos game built around real relationships and recurring contracts**.

The relationship is the primary object. Everything else — debt, Duo XP, Aura, Chaos, Wanted, Arena, bounties, Grudges, seasons — exists to create tension and decisions around that relationship.

Core rule:

**Relationships dominate. Systems recede.**

A screen should usually answer:

1. who is this about?
2. what is happening?
3. what matters now?
4. what can I do?

Do not turn Hakoware into a SaaS dashboard, CRM, habit tracker, or card soup.

## 2. Current signed-in structure

Main tabs:

- Home
- Contracts
- Arena
- You

Founder tooling:

- `/founder`

Current product direction is **UX refinement, clarity, interaction quality, and activation** — not adding lots of new mechanics.

The user explicitly wants the existing game to feel more understandable and more buttery/smooth before expanding scope.

## 3. Current visual / interaction direction

Hakoware has already gone through a major UI cleanup.

Keep:

- strong typography;
- flat hierarchy;
- restrained gold;
- red only for genuine danger;
- relationship-first cards;
- lightweight Lucide icons;
- subtle purposeful motion;
- mobile-first layouts;
- light + dark themes;
- clear tap targets.

Avoid:

- nested cards;
- pills everywhere;
- KPI grids;
- generic SaaS dashboard styling;
- unnecessary containers;
- heavy glows;
- decorative status dots;
- large explanatory blocks;
- animation for animation's sake.

Container rule:

**information uses typography/spacing/dividers; controls and exceptional states may use containers.**

Strong visual treatment is appropriate for:

- bankruptcy;
- Wanted / Most Wanted;
- live Chaos;
- bounty proof;
- destructive actions;
- security/sync failures;
- season completion.

### Required UI principles

For substantial UI work, consult:

- `jakubkrehel/skills -> better-ui`
- `emilkowalski/skills -> emil-design-eng`

The intended principles include:

- optical alignment;
- concentric radii;
- borders for structure, shadows for elevation;
- restrained stateful motion;
- `scale(.96)` press feedback;
- one icon language;
- animation must explain continuity/state;
- validate mobile and reduced-motion states.

## 4. Voice / copy

Canonical guide:

`docs/VOICE.md`

Core copy rule:

**State first. Action second. Explanation only when needed.**

Voice should be:

- short;
- specific;
- confident;
- slightly mischievous;
- not corporate;
- not tutorial-heavy.

Examples:

- `Waiting on them.`
- `1 needs attention.`
- `Debt starts after 3 days of silence.`
- `Bounties + Claim unlocked.`
- `Check in to escape.`

Do not over-compress high-stakes consequences such as:

- bankruptcy recovery;
- ending a contract;
- Claim / Return the Favor;
- bounty credit/escape;
- Aura spending;
- destructive actions.

## 5. Home

Current authenticated Home is relationship-first.

Important characteristics:

- header: `Your circle`;
- top-priority real relationship cards appear immediately;
- contract cards are the main repeated object;
- bankruptcy / active Chaos / Wanted sorting takes priority;
- secondary system metadata is quiet;
- no dashboard KPI strip;
- no standalone Season Event card.

The duplicate bottom `Grow the circle / New contract` CTA was removed in PR #58.

The primary Home `New` action remains.

## 6. Contract card design

Approved anatomy:

**identity → state → context → Duo → actions**

Do not restore the old identity rail, status dots/pills, or nested boxes.

Current card state presentation supports:

- Clear;
- due;
- overdue;
- live Chaos;
- partner-targeted Chaos;
- bankruptcy;
- season complete;
- Wanted;
- Most Wanted;
- Wanted / Most Wanted + bankruptcy.

Orbit motif exists as a **quiet reusable theme layer**, not a dominant decoration.

### Chaos target nuance

A Chaos anomaly targets one participant via `targetUserId`.

If the partner is targeted, the current user's normal contract state can still remain Clear.

The underlying grace/debt clock continues during Chaos; it is not paused or deleted.

## 7. Check-ins

Supported:

- text;
- voice.

Cadence:

- one valid check-in every **20h per side**.

Baseline XP:

- text: +10 Duo XP;
- voice: +15 Duo XP.

Duo level formula:

`floor(sqrt(xp / 50)) + 1`

Check-in is also the escape/settlement action for Wanted/bounty pressure.

## 8. Bankruptcy / recovery

Authoritative debt logic:

`server/services/debtState.js`

Bankruptcy threshold:

`total debt >= limit * 2`

Recovery:

**BANKRUPT → RECOVERING → STABLE**

First valid bankruptcy check-in:

- stops the spiral;
- returns debt to the warning/grace threshold;
- sets recovery state.

Next valid check-in after the normal gate:

- completes recovery.

Normal debt keeps running underneath Chaos / Wanted.

## 9. Chaos

Chaos events currently include:

- Voice Tax
- Double Trouble
- Aura Surge
- Wildcard
- Silence Is Expensive
- Sudden Death

Important failure examples:

- Voice Tax → Silent Treatment
- Double Trouble → Caught Sleeping
- Aura Surge → Missed the Bag
- Wildcard → Wildcard Victim
- Silence Is Expensive → Communication Criminal +2 debt
- Sudden Death → Sudden Death Casualty +2 debt

Background worker exists, with request-time fallback.

No new anomaly starts while a Wanted state is unresolved.

Chaos Ticket cannot be consumed while Wanted.

## 10. Wanted / Most Wanted / Arena loop

This was substantially upgraded in PR #57.

Wanted is now a real gameplay state:

**fail Chaos anomaly → automatic public bounty → Arena exposure → check in to escape**

### Wanted

- starts after a failed Chaos anomaly;
- 48h escape window;
- creates a system-funded Chaos bounty automatically;
- outsiders in Arena can hunt;
- the contract partner cannot hunt the automatic Wanted bounty;
- check-ins remain allowed;
- a valid check-in clears Wanted;
- normal debt continues underneath.

### Chaos bounty scaling

Locked values:

- Chaos Lv1 → 25 Aura
- Chaos Lv2 → 35 Aura
- Chaos Lv3 → 50 Aura
- Chaos Lv4 → 70 Aura
- Chaos Lv5 → 100 Aura

### Most Wanted

If the target does not check in during the 48h window:

- the state becomes **Most Wanted**;
- the bounty remains public/huntable;
- normal debt continues;
- the target remains exposed until check-in, bankruptcy/contract resolution, or season resolution as implemented.

The bounty amount does not automatically inflate just because time passed.

### Bankruptcy overlap

If a Wanted / Most Wanted target becomes bankrupt:

- do **not** create two independent bounties;
- the existing bounty becomes the single combined bounty;
- the partner may add Aura to that same bounty;
- Arena shows one total plus the funding breakdown.

Example:

`130 Aura`  
`50 Chaos + 80 Partner`

Combined cap remains 500 Aura.

This is shown as Wanted/Most Wanted + Bankrupt rather than hiding one state.

## 11. Bounty settlement

Bounty model tracks system and partner funding separately.

Key rules:

- hunter reward uses the combined total;
- if target escapes, only partner-funded Aura is refunded;
- system Chaos Aura simply closes;
- contract partner cannot hunt the automatic system bounty;
- one open bounty per target/contract is the intended model;
- hunter bond continues to scale from the displayed total.

Clean Slate can clear bankruptcy but **does not erase unresolved Wanted**.

## 12. Aura cards / game economy

Current main cards:

### Clean Slate / PURIFY
- 120 Aura;
- clears debt without changing grace rules;
- does not clear Wanted.

### Claim / STEAL
- 180 Aura;
- bankruptcy-only;
- steals 10% of current Aura;
- one per bankruptcy window;
- creates a 7-day Grudge.

### Signal Flare
- 45 Aura;
- 48h cooldown;
- sends high-priority pressure.

### Chaos Ticket
- 90 Aura;
- Chaos contract only;
- rolls next anomaly when allowed;
- unavailable while Wanted is unresolved.

Return the Favor:

- 60 Aura;
- available if original claimant later becomes bankrupt during the Grudge window;
- steals 10% and settles the Grudge.

Aura is **in-app currency, not crypto** in this Hakoware version.

## 13. Arena

Arena is now connected directly to Chaos through Wanted.

Current concepts:

- automatic Chaos bounties;
- bankruptcy bounties / partner boosts;
- Hunter Bond;
- pressure moves;
- target credit vs escape;
- combined reward totals;
- funding breakdown for Wanted/combined bounties.

Partners should see `Your contract` rather than a Hunt CTA on their partner's automatic Wanted bounty.

Do not create overlapping bounty documents for Chaos + bankruptcy.

## 14. Notifications and email

In-app notification panel is intentionally compact.

Current backend notification endpoint already supports:

- mark one read;
- mark all read;
- delete one;
- clear all.

### High-priority email delivery

PR #58 added email delivery for urgent events while preserving the in-app notification as source of truth.

Email-worthy events include:

- Chaos anomaly detected;
- Chaos failed / Wanted;
- bankruptcy;
- bounty placed / boosted;
- hunter assigned;
- hunter pressure;
- Signal Flare;
- Claim received;
- Return the Favor received.

Rules:

- respects `notificationPreferences.email=false`;
- bankruptcy email respects bankruptcy warning preference;
- test/Founder Lab accounts are skipped;
- email failure must not break gameplay;
- routine check-ins/rewards/refunds/recaps stay in-app only.

### Current interaction pass / PR #60

The notification panel already had `Mark all read`, but CSS hid it on mobile under 640px.

PR #60 changes:

- keep `Mark all read` visible on mobile;
- optimistic single-read;
- optimistic mark-all;
- optimistic delete;
- rollback + toast on API failure;
- subtle list insertion/removal/reflow motion;
- reduced-motion support.

## 15. Current interaction-quality pass

The user specifically said Hakoware still feels somewhat **static** even though the visual design is much better.

The correct response is a microinteraction/continuity pass, not a redesign.

PR #60 is focused on:

- subtle tab-entry transition;
- smoother nav state feedback;
- optimistic notification actions;
- animated notification reflow/removal;
- mobile Mark all read;
- improved touch scrolling behavior;
- reduced-motion support.

Do not make every component bounce/fade.

Frequent navigation should remain fast; motion should make state continuity legible.

### First-duo activation follow-up

The next focused pass fixes a first-check-in activation bug and clarifies the first mutual action:

- season activation sets `lastInteraction` as the debt-clock baseline, but that baseline must **not** count as a completed check-in;
- a player may make their first check-in immediately after a season starts;
- the normal 20h gate applies only after that player has actually checked in during the current season;
- first-season contract cards guide the pair through the first mutual check-in without adding another onboarding container;
- empty-state onboarding now ends with `Check in together`, not `Survive the season`.

Keep exceptional states such as Chaos, Wanted, bankruptcy, and season completion higher-priority than first-check-in guidance.

### Mobile action + picker follow-up

A focused mobile UX fix keeps critical actions visible and removes native iOS picker styling:

- `Modal` supports an optional persistent footer outside the scrollable body;
- text check-in actions live in that footer so `Check in` stays visible above mobile safe areas/browser chrome;
- normal check-in actions remain side-by-side on narrow screens; pressure-proof actions may stack;
- Inventory no longer uses native contract `<select>` controls;
- reusable `SelectMenu` provides Hakoware-styled contract pickers for Claim, Signal Flare, and Chaos Ticket;
- Inventory picker popovers open upward so they do not collide with the lower navigation/browser area.

Keep native selects out of player-facing Hakoware surfaces when a branded picker is already available.

## 16. You / Aura Market

The Product Design translation is already in production/main.

You page hierarchy:

- profile + Aura coherent top area;
- Hakoware+ stands out as a premium destination;
- Aura Market feels like an in-game destination;
- Inventory / Grudges / Privacy / Ledger / Account visually recede.

Market artwork lives in:

`src/features/profile/marketArt.js`

Art includes:

- Clean Slate;
- Claim;
- Signal Flare;
- Chaos Ticket;
- Hakoware+.

Light-mode fix:

- product card can remain light;
- item art sits on a permanent dark mini-stage so transparent/empty image space does not expose pale gutters.

Do not redesign this page again without a concrete UX problem.

## 17. Product Design prototype / visual reference

Uploaded Product Design prototype previously translated into production Home + You.

Original prototype included real market art assets and evidence screenshots.

Current production translation preserves live services/mechanics rather than prototype-local state.

Figma contract-card file exists, but Figma MCP Starter quota was previously exhausted.

Approved contract-card language should remain source of truth.

## 18. Security baseline

Major security passes are already merged.

Current protections include:

- env files ignored;
- secret-oriented CI checks;
- strict CORS with narrowly scoped Vercel preview regex;
- security headers / CSP;
- JWT auth with `authVersion`;
- founder allowlist fail-closed;
- password reset enumeration protection;
- fragment-based reset links;
- server-side authorization;
- client payload minimization;
- private voice storage;
- size + MIME whitelist;
- actual audio file-signature validation;
- request guard against:
  - Mongo operator keys;
  - dotted keys;
  - prototype-pollution keys;
  - excessive nesting;
  - excessive field counts;
- generic unexpected 500 responses;
- IP login rate limit;
- account-targeted login rate limit;
- bounded/hashed/fail-closed in-memory limiter buckets.

Regression script:

`npm run check:server-hardening`

Known architectural caveat:

- rate limiting is still process-local;
- if Railway/API scales to multiple replicas, move limiter state to Redis/shared storage.

Other known architectural caveats:

- signed-in JWT remains JS-accessible/localStorage by design because Founder impersonation currently depends on the header-token architecture;
- no full DB end-to-end suite;
- Aura/bounty flows are not globally ACID transactions.

Do not casually rewrite auth storage without treating it as a separate high-blast-radius project.

## 19. Founder Lab

Founder Lab is a disposable sandbox under:

`/founder`

Configured via:

`FOUNDER_EMAILS`

Supports:

- test users;
- test contracts;
- force Clear / Ready / Overdue / Bankrupt;
- exact Chaos events;
- test Aura;
- season completion;
- impersonation.

Isolation rules must stay intact:

- no live Arena contamination;
- no live Grudge/Shame contamination;
- no live/test hunting crossover;
- cleanup removes test objects.

## 20. Infrastructure / deployments

Frontend:

Vercel free tier.

Backend:

Railway.

Database:

MongoDB.

Email:

Brevo.

### Important quota constraints

GitHub Actions can be used as the validation gate now that the repository is public.

Vercel free-tier build-rate limits have still been hit repeatedly.

Exact Vercel failure form seen:

`upgradeToPro=build-rate-limit`

This is a deployment quota failure, **not a code build failure**.

Standard deployment truth rule:

1. inspect exact merged commit;
2. check Vercel status;
3. check Railway status;
4. only say a change is live after status success or the user confirms the production behavior manually.

The user explicitly wants branches finished before opening PRs to avoid wasting Vercel builds.

## 21. Recent merged PRs

### PR #53
Contract-card Figma redesign.

### PR #54
Product Design Home + You translation + Orbit motif + market artwork fixes.

### PR #55
Narrowly allows Hakoware Vercel preview origins through backend CORS.

### PR #56
Aura Market light-mode artwork dark-stage fix.

### PR #57
Wanted / Most Wanted / automatic Chaos bounty / combined bounty system.

### PR #58
High-priority email notifications + duplicate bottom Home CTA removal.

### PR #59
Server-side hardening:
- request guard;
- safe route errors;
- audio magic bytes;
- stronger login throttling;
- bounded rate limiter;
- hardening regression checks.

### PR #60
Current interaction-smoothness pass:
- mobile Mark all read;
- optimistic notification actions;
- notification reflow motion;
- subtle authenticated tab transition;
- restrained nav feedback;
- touch-scroll refinement.

At the time this handoff is being updated, PR #60 is intended to be squash-merged into `main` immediately after final verification.

## 22. Development workflow

User is phone-first and cares about deploy/build quota.

For repo changes:

1. inspect exact current `main`;
2. create a focused branch;
3. implement fully;
4. audit the diff;
5. do not open a PR until the work is finished;
6. open one PR;
7. verify exact head;
8. squash merge only when explicitly requested/appropriate;
9. check exact merged deployment status;
10. use real iPhone testing as a primary UX signal.

Do not spam PRs for intermediate iterations.

Do not force-update `main`.

If a branch is stale after another PR merges, rebase/reset/reapply carefully so newer security/product changes are not regressed.

## 23. UX priorities going forward

The current priority is **not more mechanics**.

Focus on:

- interaction smoothness;
- first-duo activation;
- progressive disclosure;
- clearer state transitions;
- reducing friction;
- mobile behavior;
- notification usefulness;
- clearer consequences;
- making the game understandable without reading docs.

A new player should initially understand:

**pick someone → make a contract → check in → don't disappear**

Then the game can progressively reveal:

- debt;
- Aura;
- Chaos;
- Wanted;
- Arena;
- bankruptcy;
- Grudges.

Do not explain every system upfront.

## 24. Product metric to care about

The strongest near-term activation metric is:

**Of people who create an account, how many reach one accepted contract and complete the first mutual check-in?**

This matters more right now than vanity signup counts.

The strongest product question is now:

**Does the relationship loop feel fun/tense/shareable enough that one person brings another person in and both keep returning?**

The next retention signal after first mutual check-in is:

**Does either person come back the next day without being manually reminded?**

### Social-presence retention pass

A focused pass adds ambient life between the 20h progression check-ins without changing debt/XP pacing:

- Home can show a restrained **While you were gone** pulse from recent contract events;
- the pulse is not a generic feed and should stay high-signal / short;
- players can react to a partner's recent check-in with one of four lightweight reactions: 💀 / 🤝 / 👀 / 😭;
- reactions are social-only: no Duo XP, Aura, debt, or progression effect;
- after a player checks in, the ordinary secondary action becomes **Poke** instead of a dead disabled Voice action;
- pokes are social-only, mutual-contract-only, and limited to one per contract every 4 hours;
- reactions and pokes create in-app notifications, not urgent transactional email;
- check-in remains the meaningful once-per-20h progression action.
- active-contract bounty/pressure state is warmed in the background after contract sync so opening Check in should not normally block on “Syncing Arena…”;
- the check-in modal consumes cached verification immediately, then quietly revalidates; the server remains authoritative if Arena state changes before submission.
- mobile check-in state hierarchy is intentionally compact: debt/recovery is one row and Last/Grace are inline metadata; do not restore the tall stacked metadata rows.

### Open social loops

The next retention pass should be understood as **unfinished business**, not extra buttons:

- text check-ins can carry a lightweight status: `alive`, `locked in`, `barely`, or `chaos`;
- text check-ins can also include one optional note up to 40 characters;
- a partner can send exactly one 40-character reply to the latest recent check-in; it is not a chat thread and cannot branch;
- reactions remain available alongside the one-shot reply;
- if a partner pokes you within the mutual window, **Poke back** is available even if your daily check-in is still due;
- two reciprocal pokes within 2h create **Mutual Menace** for 3h;
- Mutual Menace wakes one timed contract moment; moments rotate per contract in the order **Hot Seat → Split Decision → Double Dare** so each mechanic is actually testable;
- **Hot Seat** brews for 15–35 minutes, then opens for 12h;
- **Split Decision** brews for 8–20 minutes, gives both players the same two-way social dilemma, hides both choices until they are locked, then reveals whether the duo landed on the same side or split;
- **Double Dare** opens immediately for the player who completed Mutual Menace: they choose one safe social dare, the partner later accepts or passes, and the result returns through the contract / social pulse;
- Double Dare is deliberately one exchange, not a dare thread or chat;
- a dedicated backend moment worker advances brewing/open timers every ~60s by default, so Hot Seat evolves while both players are away;
- each person answers independently and answers stay hidden until both are locked;
- the resolved reveal remains visible on the contract for 6h;
- Hot Seat prompts should be socially spicy / revealing, but non-explicit and safe for a general-audience relationship product;
- timed moments are scoped to the current season and removed when the contract ends;
- Home prioritizes open Hot Seat / Mutual Menace states above ordinary clear contracts;
- when Hot Seat opens, the worker creates in-app notifications for both players;
- social presence also revalidates every minute while the app is foregrounded and immediately when the app becomes visible again.

Retention rule:

**A starts something → B discovers/responds later → A has a reason to come back for the outcome.**

Do not add a prediction/wager mechanic.

Product rule:

**one meaningful progression action per day, many tiny social responses throughout the day.**

Do not turn this into chat, followers, a public social feed, or notification spam.

## 25. Social-safety design rule

Hakoware intentionally uses mischievous mechanics:

- bankruptcy;
- bounties;
- pressure;
- Shame;
- Claim;
- Aura stealing;
- hunting.

These should remain **consensual social tension**, not stranger-harassment tooling.

Keep asking:

**Can this mechanic create fun tension between consenting players without giving strangers a tool to harass someone?**

Existing safeguards like mutual contracts, partner-hunt restrictions, privacy controls, and test/live isolation are important.

## 26. Known cleanup / technical debt

Not urgent, but worth remembering:

- dormant `nenType` backend concept remains even though visible Affinity was removed;
- process-local limiter should become shared if horizontally scaling;
- auth storage migration to HttpOnly would require redesigning Founder impersonation;
- no full database E2E suite;
- some economy operations are not globally transactional.

Do not mix these into ordinary UX work unless intentionally doing a dedicated architecture/security project.

## 27. Resume checklist

When a new chat picks this up:

1. read this file;
2. inspect current `main`;
3. check open PRs and latest merged SHA;
4. check Vercel + Railway status before saying anything is live;
5. remember Actions/Vercel quota constraints;
6. for UI work use the Better UI + Emil principles;
7. preserve relationship-first hierarchy;
8. preserve approved contract-card anatomy;
9. do not add mechanics by default;
10. prioritize smoothness, clarity, activation, and mobile UX;
11. test on iPhone whenever possible;
12. keep copy short but consequences explicit.

