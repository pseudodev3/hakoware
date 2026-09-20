# Hakoware Project Handoff

> **Read this first when continuing Hakoware in a new chat.**
>
> Repo: `pseudodev3/hakoware`  
> Frontend: `https://hakoware.vercel.app`  
> Backend: Railway  
> Database: MongoDB  
> Transactional email: Brevo  
> Last updated: **2026-09-19**
>
> Current main baseline: **`b6c70ae893f7badc9502540cc6651e006262715a`**
>
> The fastest safe resume prompt is:
>
> **Read `HANDOFF.md`, inspect current `main`, and continue Hakoware from there. Do not assume a merged change is live until deployment status is checked.**

## 1. Current status

Current `main` includes the recent UI simplification, responsive polish, core microcopy compression, the secondary signed-in copy pass, and the canonical voice guide.

Latest relevant commits:

- `5ee5132fc4a608d05953705ddf3b4d26a6297971` - simplify signed-in app UI hierarchy
- `c9923f1d53ffe01a9a19177018c25fec64f7ba5e` - remove unnecessary boxes from signed-in UI
- `01581b64734ca98151eac635b924a4309c4218d4` - responsive spacing and typography pass
- `f0d623858516cc6f6da970a369b830c756bdff18` - compress core Hakoware microcopy
- `a7c3db710f9703b8f15c0287fd74988eece61f69` - finish core microcopy compression
- `b6c70ae893f7badc9502540cc6651e006262715a` - compress secondary UI copy and add voice guide

At handoff time:

- Railway for current main: **success**
- Vercel for current main: **blocked by free-tier build-rate-limit**
- therefore, merged frontend changes may still lag behind the code in `main`

Do not claim current frontend changes are live unless Vercel later succeeds or the user manually confirms the UI.

### Stale branch warning

The branch `copy/compress-core-flow` is stale/diverged and should not be used as the starting point. Equivalent/newer copy work is already on `main`.

## 2. Product direction

Hakoware is a **social-chaos game built around real relationships and recurring contracts**.

It should feel like a game first, not a productivity dashboard, CRM, admin panel, or generic SaaS app.

Current signed-in areas:

- **Home**
- **Contracts**
- **Arena**
- **You**

Founder tooling lives separately at:

- `/founder`

### Core product principle

**Relationships dominate. Systems recede.**

A user should primarily see:

- who they are playing with;
- what is happening between them;
- what matters now;
- what action they can take next.

Duo XP, debt, Aura, Chaos, seasons, bounties, Grudges, Wanted, etc. should support that relationship state instead of each becoming its own dashboard card.

## 3. UI direction and anti-slop rules

The UI has recently gone through a major cleanup because the signed-in app had too many boxes, cards, pills, shadows, glows, KPI grids, and repeated explanatory panels.

The current direction is intentionally flatter and more editorial.

### Keep

- clear typography hierarchy;
- spacing and dividers;
- restrained gold accents;
- red for genuine danger/exception state;
- green/blue only where semantically useful;
- relationship lists;
- metadata rows;
- strong primary actions;
- mobile-first layout;
- light and dark mode;
- subtle purposeful motion;
- real controls with clear tap targets.

### Avoid

- card soup;
- stat-box grids;
- nested cards inside cards;
- glowing status pills;
- decorative badges that do not communicate meaningful state;
- rounded containers around ordinary information;
- giant icon tiles for normal content;
- "AI SaaS dashboard" visual language;
- adding a new visual component to explain information that can fit into existing hierarchy;
- overusing uppercase mono micro-labels;
- generic dashboard copy;
- rebuilding already-clean areas just to make them look different.

### Container rule

Use containers for:

- actual controls;
- selection targets;
- inputs;
- buttons;
- avatars/identity objects;
- toggles;
- modal shells;
- truly exceptional state.

Ordinary information should usually use:

- typography;
- spacing;
- alignment;
- dividers;
- restrained color.

### Exceptional states that may be visually stronger

- bankruptcy;
- Wanted;
- live Chaos;
- bounty proof;
- destructive actions;
- security/sync errors;
- season-complete moments.

## 4. Required design skills for future UI work

The user explicitly wants these two design skills consulted for Hakoware UI work.

### Better UI

Repo:

`https://github.com/jakubkrehel/skills`

Skill:

`better-ui`

Install command the user provided:

```bash
npx skills add https://github.com/jakubkrehel/skills --skill better-ui
```

Direct skill file in the repo:

`skills/better-ui/SKILL.md`

Related useful skills from the same repo:

- `skills/better-layout/SKILL.md`
- `skills/better-typography/SKILL.md`

These were also consulted during the responsive/layout pass.

### Emil Design Engineering

Repo:

`https://github.com/emilkowalski/skills`

Skill:

`emil-design-eng`

Install command the user provided:

```bash
npx skills add https://github.com/emilkowalski/skills --skill emil-design-eng
```

Direct skill file in the repo:

`skills/emil-design-eng/SKILL.md`

### Rule for future chats

Before making substantial signed-in UI changes:

1. inspect current `main`;
2. consult `better-ui`;
3. consult `emil-design-eng`;
4. use `better-layout` and `better-typography` when layout/type is involved;
5. preserve Hakoware's existing visual language instead of introducing another design system.

Do not say these skills are installed unless the environment confirms that. If they are not installed, read the skill files directly from the GitHub repos before UI work.

## 5. Current microcopy direction

The UI cleanup exposed that some screens were visually clean but too wordy.

Canonical voice guide: `docs/VOICE.md`

The current copy direction is:

**state first, action second, explanation only when needed.**

Hakoware copy should be:

- short;
- specific;
- confident;
- slightly mischievous;
- never corporate;
- never tutorial-heavy;
- never padded with explanation the user already understands from context.

### Examples of the intended voice

Prefer:

- `Waiting on them.`
- `Season 1 starts when they accept.`
- `1 needs attention.`
- `Debt starts after 3 days of silence.`
- `Bounties + Claim unlocked.`
- `Inside grace period.`
- `One check-in every 20h. Resets your side + earns Duo XP.`

Avoid:

- long explanatory paragraphs for routine states;
- repeating the heading inside the description;
- "this feature allows you to...";
- multi-sentence onboarding explanations when one line is enough.

### Do not over-compress high-stakes copy

Keep enough detail for:

- End contract;
- bankruptcy recovery;
- bounty hunter credit;
- Claim / Revenge;
- Aura spending;
- destructive or irreversible actions;
- security/sync failures.

Concise is good. Ambiguous is not.

## 6. Current Home / Contracts UX

### Home

Current design direction:

- one strong relationship-state hero;
- Aura is quiet;
- weekly/world modifier is integrated into the same metadata system, not shown as a standalone Season Event card;
- Strongest Duo / active / reports / Chaos / world modifier are compact metadata;
- relationship cards are a single-column list;
- temporary states use strips rather than cards;
- no KPI grid.

World modifier should read like:

`Anomaly Season · Chaos cycles faster`

Do not restore:

- standalone `SEASON EVENT ACTIVE` card;
- yellow pulsing activity dot;
- repeated Season Event banners across tabs;
- separate "Weekly rule" hero block.

### Contracts

Incoming challenges appear **before** the rest of Contracts so a newly invited user does not need to scroll to find Accept/Decline.

Current flow:

- incoming challenges first;
- roster header;
- compact metadata;
- waiting requests;
- active contracts.

Contract cards are built around:

**person → state → Duo progress → action**

Important information still visible:

- person;
- handle;
- contract mode;
- season;
- time left;
- due/debt state;
- bankruptcy;
- Duo level/title/XP;
- live Chaos;
- Wanted;
- primary check-in actions.

Do not re-add a separate season progress bar unless there is a strong product reason. Duo XP is the single persistent progress meter.

## 7. Onboarding

The onboarding was recently simplified.

### Username-first identity

Public identity is username-first.

- username is public;
- email remains operational/private for recovery, invites, and important account functions;
- login accepts username or email;
- new signup requires username + email + password;
- legacy users without usernames get a one-time claim screen;
- username changes are not implemented yet;
- X OAuth is not implemented yet.

### New Contract flow

Current flow:

**Person → Contract → Confirm**

The first screen asks for:

- `@username`, or
- email.

The strongest four contract modes show first:

- Don't Ghost Me
- Long Distance
- 30-Day Lock-In
- Chaos

Other modes are behind `More contracts`.

Do not restore a tutorial carousel.

### Affinity / Nen

Affinity/Nen is removed from visible UI because it currently has no gameplay effect.

The backend `nenType` field remains dormant for possible future reuse.

Do not expose Affinity again unless it is given a real gameplay or profile consequence.

## 8. Notifications

Notifications were simplified because the previous panel used too much vertical space.

Current direction:

- flatter activity feed;
- compact rows;
- unread state uses subtle edge/background treatment;
- icon actions instead of text-heavy Mark read/Delete rows;
- voice inbox is compact;
- voice notes are list rows, not large cards.

Do not restore large notification cards for routine activity.

## 9. Contract settings / modal hierarchy

A dedicated container audit removed unnecessary boxes from:

- Contract Settings;
- text check-in;
- voice check-in;
- recap;
- bounty creation;
- pressure moves;
- onboarding confirmation;
- notifications;
- Home notices.

Contract Settings should stay flat:

- mode summary as metadata/divider;
- grace-period explanation as a row;
- Chaos info as a state strip;
- End Contract remains visually strong because it is destructive.

General rule:

**information uses hierarchy, controls use containers.**

## 10. Contract modes

Current templates:

- `DONT_GHOST` - Don't Ghost Me
- `GYM_PACT` - Gym Pact
- `STUDY_ARC` - Study Arc
- `LOCK_IN` - 30-Day Lock-In
- `LONG_DISTANCE` - Long Distance
- `BUILD_IN_PUBLIC` - Build in Public
- `CHAOS` - Chaos Contract
- `CUSTOM` - Custom

Typical seasons are 30 days.

Long Distance uses 45 days.

Duo progression persists across seasons.

Current Duo level formula:

`level = floor(sqrt(xp / 50)) + 1`

Minimum level is 1.

Titles currently include:

- New Contract
- Locked In
- Partners in Crime
- Certified Menaces
- Habitual Enablers
- Unbreakable Contract
- Legendary Duo

## 11. Check-ins

Hakoware supports:

- text check-ins;
- voice check-ins.

General check-in cadence:

- one valid check-in every **20 hours** per side of a contract.

Baseline XP:

- text: +10 Duo XP;
- voice: +15 Duo XP;
- Long Distance voice gets extra bonus;
- Chaos/world modifiers can change XP.

The UI should not prompt a new user to check in immediately after a contract starts if the 20-hour gate means they are not eligible.

The Season 1 start briefing is informational, not a forced first-check-in CTA.

## 12. Bankruptcy

Authoritative debt logic:

`server/services/debtState.js`

Bankruptcy threshold:

`total debt >= limit * 2`

Recovery flow:

**BANKRUPT → RECOVERING → STABLE**

First valid check-in while bankrupt:

- stops the debt spiral;
- debt drops to the grace limit/warning threshold;
- `recoveryRequired = true`;
- state becomes Recovering.

Next valid check-in, at least 20h later:

- clears recovery debt;
- `recoveryRequired = false`;
- returns to Stable.

Historical scar fields exist so bankruptcy remains part of recap/history.

Bounties remain bankruptcy-only.

## 13. Bounties, Claims, Grudges, Revenge

Bounties:

- only on a bankrupt contract partner;
- amount: 10 to 500 Aura;
- poster escrows reward;
- listing fee applies;
- hunter stakes bond;
- hunter sends pressure;
- target decides whether hunter actually caused the return:
  - credit hunter;
  - or escape.

Claim:

- cost: 180 Aura;
- only on bankrupt partner;
- steals 10% of target's current Aura;
- one Claim per bankruptcy window;
- creates a public Grudge for 7 days.

Return the Favor:

- cost: 60 Aura;
- available if the original claimant later becomes bankrupt during the Grudge window;
- steals 10% of claimant's current Aura;
- settles the Grudge.

## 14. Aura cards

Current cards include:

### Clean Slate / PURIFY
- cost: 120 Aura;
- clears debt across active contracts without changing grace rules.

### Claim / STEAL
- cost: 180 Aura;
- bankruptcy-only;
- steals 10% of current Aura;
- creates Grudge.

### Signal Flare
- cost: 45 Aura;
- 48h cooldown;
- sends a high-visibility pressure signal.

### Chaos Ticket
- cost: 90 Aura;
- Chaos Contract only;
- forces next anomaly roll if none is active.

Aura is an in-app game currency, not a crypto token in this Hakoware version.

## 15. Chaos and world modifiers

Chaos anomaly types include:

- Voice Tax
- Double Trouble
- Aura Surge
- Wildcard
- Silence Tax
- Sudden Death

Failed Chaos may apply debt and Wanted.

Wanted lasts 48h.

Background Chaos worker exists and request-time fallback remains.

Current deterministic weekly modifiers include:

- Duo Rush
- Open Mic
- Clean Sweep
- Anomaly Season

The weekly modifier still changes gameplay. Only the presentation was simplified.

## 16. Founder Lab

Founder email is configured through:

`FOUNDER_EMAILS`

Known founder account:

`hakoware265@gmail.com`

Private route:

`/founder`

Founder Lab supports:

- disposable test users;
- real test contracts;
- force Clear / Ready / Overdue / Bankrupt;
- exact Chaos events;
- test Aura;
- end seasons;
- impersonate test users.

Sandbox rules:

- test bounties do not enter live Arena;
- test Grudges do not enter live feed;
- test Shame Board entries stay isolated;
- test and real users cannot hunt each other's bounties;
- cleanup removes disposable test objects.

## 17. Security / infrastructure hardening already done

Important security pass was merged earlier.

Current protections include:

- env files ignored;
- secret scanning in CI;
- frontend CSP/security headers;
- HSTS/frame/referrer/permissions policies;
- auth/signup/reset/invite/voice/growth rate limits;
- `authVersion` token revocation after password reset;
- shorter founder impersonation tokens;
- founder middleware fails closed if `FOUNDER_EMAILS` is unset;
- minimal `/health`;
- normal contract payloads avoid exposing partner email;
- generic forgot-password response;
- fragment-based reset token URL;
- voice MIME whitelist;
- voice notes remain PENDING until a valid check-in commits them;
- abandoned pending voice notes are cleaned up;
- CI runs frontend/backend production audits and syntax/build gates.

Architectural caveats:

- normal auth token is still JS-accessible because of current impersonation/header-token architecture;
- in-memory rate limiter is per Railway process;
- shared store needed if horizontally scaling;
- no full DB end-to-end suite;
- Aura/bounty flows are not globally ACID Mongo transactions.

## 18. Background workers

Already merged:

- debt-state worker;
- Chaos worker.

Debt worker default cadence is roughly every 5 minutes.

Chaos worker default cadence is roughly every 60 seconds.

Request-time fallbacks remain.

Founder/test data should remain excluded where appropriate.

## 19. Email

Provider:

**Brevo**

Current branding:

- backend serves email logo from `/brand/hakoware-mark-v2.jpg`;
- email header uses email-safe table layout;
- password recovery copy is simplified;
- old HxH/Association/protocol language was removed.

Current logo assets include:

- `/public/hakoware-mark-v2.png`
- `/public/favicon-v2.png`
- `/public/apple-touch-icon-v2.png`
- `/public/hakoware-mark-v2.jpg`
- `/public/og-image-v2.jpg`
- `/server/assets/hakoware-mark-v2.jpg`

Do not recreate the logo.

## 20. Growth / monetization state

Immediate growth target:

**first 20 activated Duos**

Not 1,000 signups.

Growth features already implemented:

- invite sharing;
- recap sharing;
- strongest Duo sharing;
- live Chaos sharing;
- first-party share telemetry;
- Founder growth scorecard;
- Hakoware+ interest capture.

Hakoware+ is only an early preview. Payments are **not** implemented.

Current Plus concepts:

- full season archive;
- deeper Duo stats;
- advanced custom contracts;
- premium recap styles;
- Duo cosmetics.

Core game should remain free.

Do not sell Aura.

## 21. Launch state

Hakoware has already been publicly launched on X.

Launch URL:

`https://hakoware.vercel.app`

The user posted the launch from their X account and is aiming for first real Duos.

A Reddit launch attempt was filtered by Reddit's automated filters. Reddit is not a current priority.

## 22. Known deployment issue

Vercel repeatedly fails with:

**free-tier build-rate-limit**

This is not the same as a code build failure.

Standard workflow:

1. merge;
2. check Vercel status;
3. check Railway status;
4. do not say "live" unless current deployment confirms it or user manually sees it.

## 23. Engineering workflow

For repo changes:

1. inspect current `main`;
2. create a focused branch;
3. implement narrowly;
4. run/await `.github/workflows/validate.yml`;
5. inspect exact diff;
6. open PR;
7. verify PR head;
8. squash merge;
9. check merged commit deployment statuses;
10. do not claim device behavior without actual device confirmation.

Validation currently includes:

- frontend dependency install;
- frontend production audit;
- tracked env rejection;
- obvious secret scan;
- frontend production build;
- backend install;
- backend production audit;
- backend syntax check.

## 24. Important UX findings from real iPhone testing

The user tests primarily on iPhone.

Already found/fixed:

- iOS/Brave form focus auto-zoom caused by sub-16px inputs;
- mobile form fields now enforce 16px on coarse/mobile pointers;
- pinch zoom remains enabled;
- onboarding became much smoother after username-first flow + Person → Contract → Confirm;
- incoming invite acceptance moved above the fold;
- notifications were too large for too little information and were flattened;
- immediate post-acceptance check-in CTA was misleading and removed;
- standalone Season Event card felt "vibecoded" and was removed;
- excessive cards/boxes/pills/glows were systematically removed.

Keep real iPhone screenshots as a primary UX signal.

## 25. What to do next

The broad signed-in copy-compression pass is complete on `main`.

It now covers:

- Home;
- Contracts and contract creation;
- check-in/settings flows;
- Arena;
- You;
- Notifications and voice inbox;
- recaps;
- bounty/pressure modals;
- key toasts and empty states.

The canonical copy standard is `docs/VOICE.md`.

### Next copy work should be evidence-led

Do not start another broad rewrite by default.

Use real iPhone screenshots and actual gameplay to find:

- text that wraps badly;
- copy that became too terse to understand;
- backend-generated notification messages that still sound verbose;
- high-stakes actions whose consequences need clearer wording.

Preserve the current short voice and only expand copy when clarity or consequences require it.

## 26. Resume checklist for a new chat

When picking this project up again:

1. read this file;
2. inspect current `main`;
3. check latest Vercel/Railway statuses;
4. do not use stale `copy/compress-core-flow`;
5. if doing UI work, consult:
   - `jakubkrehel/skills -> better-ui`
   - `emilkowalski/skills -> emil-design-eng`
   - and related better-layout / better-typography guidance;
6. preserve the current flat hierarchy;
7. do not restore card soup;
8. keep copy short;
9. keep high-stakes consequences explicit;
10. validate and squash merge through the normal repo workflow.
