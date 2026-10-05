# Hakoware Project Handoff

> **Read this first when continuing Hakoware in a new chat.**
>
> Repo: `pseudodev3/hakoware`  
> Frontend: `https://hakoware.vercel.app`  
> Backend: Railway service `joyful-clarity - hakoware`  
> Database: MongoDB  
> Transactional email: Brevo  
> Last updated: **2026-10-05**
>
> Safe resume prompt:
>
> **Read `HANDOFF.md`, inspect current `main`, then continue Hakoware from there. Do not assume a merged change is live until the exact deployment status or device behavior is verified.**


## Current continuation checkpoint — 2026-10-05

Current production/main:

- PR #83, the product revamp and atomic card purchase repair, is merged on top of PR #82 / #81 / #80 / #79 / #78.
- Exact squash SHA: `504a9a118eb695a4a8ca3fa537deb68efa7f8d44`.
- GitHub validation, Vercel and Railway passed for that exact merged SHA. Production served the new HTML/CSS and Public Sans font; backend health passed after deployment.
- The user confirmed a successful live card purchase after the merge. Production database topology/logs and live two-account trades remain unverified.
- The user bought `hakoware.xyz`. Domain routing and canonical metadata have not been changed in the current polish branch.

Current implementation branch: `feat/social-home-polish` (not deployed).

### Social home polish — current implementation

The user wants a more inviting, intentional interface and Home contract cards that blend into Hakoware and read as friendships. Keep Public Sans, the ink/paper/lime/violet palette, original shaded card artwork, and real social state.

- Friend cards shared by Home and Circle now lead with round avatars, person identity, actual activity time, a more readable conversation/activity preview and an explicit Open / Start conversation affordance. A compact footer holds actual Duo level, contract state and the existing separate check-in / recap action. Borders distinguish real new updates and danger; no online presence is implied.
- The preview picks a newer dated activity over an older message, so a fresh check-in/poke is not hidden. Invalid/missing timestamps omit the time; future clock differences clamp to now. The new-update badge still counts mixed updates, not unread messages, and is included in the conversation button's accessible description.
- Long names clamp to two lines, handles to one, previews to two, with full person names and previews available to assistive technology. Failed/missing avatars retain the existing initial fallback. Unavailable actions do not display a completion checkmark.
- Home has a cleaner header with Add friend and a Friends section with Open circle / See all N. The three prioritized slots, bankruptcy/Chaos/recovery ordering, contract rules and actual activity acknowledgement remain intact. Card and play-section heading spacing is aligned.
- Validation: production build, full lint with zero errors (existing warnings remain), circle-activity checks and independent diff review. Browser fixtures cover Home and Circle at 320×844, 390×600, 390×844 and 1280×844 in both themes; actual font loading, 44px actions, conversation return focus, keyboard activation, actual update descriptions, newest/invalid/future preview timestamps, no messages, broken avatars/long identity, recovery, completed Recap, missing perspective, open/waiting moments, shared first payoff, and See all routing. Existing full revamp browser interactions also pass, including purchase retry, five-tab navigation, wall sheets, Activity and empty-circle discovery. These are fixtures, not live account or physical iPhone tests.
- Review notes: `docs/social-home-ui-review.md`. Finish exact-head CI, then open one finished PR. Merge only on explicit instruction; verify exact frontend/backend deployments after merging.

### Product revamp + card purchase repair — merged PR #83 baseline

The user asked for new colors/layout, one clear font everywhere, stronger visual hierarchy, a playful product identity and better reasons to return. The default direction is ink / electric lime with violet for the wall; they were offered an optional color preference. That request supersedes the earlier token/layout preservation guidance where it conflicts with a cohesive revamp. Preserve the shaded existing market/card artwork and the relationship-first model.

- Self-hosted variable Public Sans (27 kB WOFF2, OFL included) is used across text, headings, numbers and controls. Remove the old monospace split and profile serif heading. Font loads from the app, not a third-party font service.
- Shared light/dark tokens use ink / paper, lime navigation/action states, violet wall surfaces, and separate gold Aura / red danger / green healthy meanings. Five primary destinations — Home, Circle, Arena, After Hours, You — share one phone dock and one desktop sidebar. There is no extra mobile shortcut tier; all destinations stay reachable from every main tab. Friend conversations still hide the dock for the composer.
- Home leads with actual friend/message previews. A side panel on desktop and tiles below the circle on phones expose actual discovered cards, incoming offers and this week’s wall. Incoming offers open their exact offer. A quiet/empty circle still has useful collection and free wall actions. Failed reads do not invent counts or contributors.
- Arena has a clearer page/tab hierarchy; the collection has twelve discovery segments, a Yours filter, stronger artwork and ownership labels, and the same prices/effects. After Hours uses violet, a tactile dot canvas and a sticky Add / Browse toolbar above the board, including on short phones. Friend spaces, profile, Circle and Activity use the same visual system. The landing page explains friend spaces, cards and the wall while retaining the approved atmospheric artwork.
- Purchases no longer depend on replica-set transactions. An atomic User update commits Aura debit, inventory delivery, discovery and a private durable retry receipt together. Concurrent requests with one key cannot charge/deliver twice, and separate requests cannot overspend. Previous CardPurchase receipts remain authoritative. The ledger and external receipt are idempotently journaled; a committed purchase returns success even if journaling fails, and a one-minute worker or retry repairs the audit. Private receipts are retained to prevent old retries from charging again; no migration is required. AuthContext’s older purchase path also retains a retry key after uncertainty.
- Trading still requires MongoDB replica-set transactions. Standalone trades now return a deliberately public 503 message instead of the generic 500; cards remain untouched. Do not weaken the multi-account exchange into separate writes. If production is standalone, enable a replica set/Atlas before expecting trades to work.
- Validation: production build, full lint with no errors, existing circle / payload / activation / hardening / real-Mongo friend-space / cards-wall checks. Added real standalone-Mongo purchase coverage for all twelve cards, same-key concurrency, last-Aura races, committed response retries, interrupted ledger recovery, old receipts, privacy and safe trade denial. Browser fixtures cover 320×844, 390×600, 390×844 and 1280×844, both themes, normal/reduced motion, five-tab reach, actual font loading, purchase response loss/retry, filtering, modal keyboard/focus restoration, sticky wall controls, conversation return, Activity and exact incoming-offer routing. Landing/login and empty-circle discovery are checked too.
- Review notes: `docs/product-revamp-ui-review.md`. Browser API fixtures do not establish live delivery. Physical iPhone/Safari and production two-account trades still require device testing. The user subsequently confirmed a live purchase after PR #83 deployed. Existing bundle-size and AfterHoursSpark duplicate-index warnings remain.
- Finish exact-head CI before opening one finished PR. Merge only on explicit instruction, then verify the exact merged frontend and backend deployments. A frontend preview still talks to the currently deployed backend, so it cannot validate the purchase repair before Railway receives this code.

The cards/wall implementation below is the merged PR #82 baseline.

### Cards + the weekly After Hours wall — current implementation

The user approved collecting/trading usable cards and a persistent shared wall as concrete activities for a small community. They rejected Hunter Runs / maps and vague challenge loops; do not reintroduce those. They explicitly rejected the initial outline-icon card art. Preserve the existing market’s shaded objects and dark mini-stages: the original four artworks are reused, and the eight new marks have matching metal/enamel object artwork.

- Arena opens on Cards, with Collection / Offers and All / Tools / Wall marks filters. Twelve numbered cards include the original four single-use tools at unchanged prices/effects and eight reusable wall marks (20–35 Aura). Existing Aura earning rules fund purchases; there is no new XP/Aura faucet, random pack or rarity system. Discovered cards stay in the collection after consumption or a trade.
- Card details support purchase, tool activation, wall navigation and offers. You links to the same collection; its existing utility-card activation controls remain. Sticker cards are never offered as consumable tools.
- Trades are initially limited to ACTIVE accepted friends. An offer reserves exactly one offered copy for seven days. The other person can accept, decline, or counter; the sender can cancel. Acceptance exchanges both copies in one MongoDB transaction, changes no Aura/XP, and records a shared friend-space event. Expired offers and ended contracts return escrow exactly once through on-demand settlement and a one-minute worker. Open offers are fetched separately from the last forty closed offers so history cannot hide reservations.
- Purchases use unique retry receipts, and offers use unique sender/client keys. The browser keeps retry keys for uncertain purchases/posts/offers while the draft is unchanged. Atomic one-copy inventory removal prevents an offered copy from also being used. Existing spell effects retain their progression rules; the wider Aura economy is still not globally transactional.
- **Deployment requirement (PR #82 baseline):** transactions were required for purchases and trades; the current revamp branch removes that requirement for purchases only. Trades still require a replica set (Atlas is suitable), and unsupported standalone MongoDB must return a safe 503 without separate exchange writes. No production dependencies or migration scripts were added; new models/indexes and `cardDiscoveries` are additive.
- After Hours opens on Wall; Room retains the existing posts, replies, Sparks, notes and secondary question. The two surfaces and Arena sections persist in URL history. Existing bounty links open Bounties, and room-post links open Room rather than losing their target in the wall.
- A shared signed wall accepts 90-character notes, small pointer/touch sketches, and stamps from currently available owned sticker cards. Stamping keeps the card. Notes/sketches are free. Drawings use validated normalized point arrays, never uploaded SVG/HTML. Six colors, twelve strokes, forty stored points per stroke.
- UTC Monday starts a fresh wall. Current plus three preceding weekly walls remain available; prior weeks are read-only and expire after four weeks. Maximum sixty marks per wall, eight per person. There are no fabricated participants or seeded live contributions.
- Only authors can move/remove their marks. Movement has drag, keyboard arrows and 44px arrow controls. Browse marks opens even a buried/overlapping piece. Reactions use the existing four emoji, one per person/mark, with at most one targeted notification per giver/mark/week. There are no new progression rewards.
- Wall revision compare-and-swap preserves concurrent edits. Drafts survive failed saves and replay with the same client ID. Live users and Founder Lab owners have separate wall scopes; trades cannot cross those boundaries. Reset removes the owner’s test trades, purchase receipts and wall. Public wall and activity payloads omit raw actor, sender/recipient and scope IDs.
- Activity opens the exact offer or wall mark/week. Missing/deleted/expired targets show an explicit unavailable state. Native modal sheets make the background inert, wrap keyboard focus, restore trigger focus, keep the footer reachable, and support Escape. Inputs/selects use 16px; controls use at least 44px; press feedback is .96 / 140ms and respects reduced motion. Wall positioning stays intact during reduced-motion presses.
- Validation and visual review are recorded in `docs/cards-wall-ui-review.md`. CI adds `check:cards-wall` with a real isolated MongoDB 8.0.12 replica set, auth, concurrency, escrow, inventories, privacy and wall ownership/archive checks. Existing friend-space / payload / activation / circle / hardening checks pass. Full lint now has no errors (the old profile hook-name errors were fixed while integrating the collection). Production dependency audits pass.
- Physical iPhone/Safari and production two-account trades/wall interactions are not verified. The existing bundle-size and AfterHoursSpark duplicate-index warnings remain. Finish exact-head CI before opening one finished PR; merge only on explicit instruction, then verify both exact merged deployments.

Possible next activities to discuss (not implemented): a private duo wall/keepsake that grows through actual conversation; a friends’ voice soundboard using real contributed clips; a display case where friends arrange and show their owned collection. Keep follow-ups tied to something people make or exchange, not more daily prompts.

Friend spaces below are merged in PR #81.

### Friend spaces — merged baseline

The user explicitly approved simpler clickable friend cards and a persistent place to talk inside each accepted contract. This supersedes the older prohibition on contract chat below. After Hours notes remain short notification-only interactions; strangers still cannot start unrestricted DMs.

- Home and the active Contracts roster use quiet friend cards: identity, latest message/activity preview, one consequential state, and a separate 44px quick Check in / recap action. Home still prioritizes bankruptcy, Chaos, Wanted, recovery, season completion and open moments; it still fills three slots.
- Tapping a card opens `/circle/<opaque-contract-key>` with text/voice conversation and shared check-in/event history. Reloads, native browser history, card focus restoration and Activity links work. Contract details retain the existing XP, settings, reactions, moments, bounty and season controls behind a Contract toggle; switching views preserves conversation scroll position.
- Conversation is available only to participants of ACTIVE accepted contracts, including a completed season. Pending / ended / foreign contracts deny access. There are no stranger messages, followers or new public feed.
- Sending an eligible message also performs the canonical check-in. The 20h cap, XP, Aura, Chaos, debt and two-step bankruptcy recovery rules remain intact. Further messages are social only. Hunter proof still requires explicit Credit / Escape through Check in; Voice Tax requires a voice message or voice check-in.
- Manual and message check-ins share `server/services/contractCheckin.js`, protected by a database per-contract lease across instances. Text sends use persistent retry keys and unique indexes; committed voice attachments are owned, scoped and single use. A failed progression action does not erase a delivered message.
- `ContractEvent` MESSAGE records persist text/voice references. Timeline pages contain 40 entries with compound time/id cursors, and support an exact older Activity target outside the current page. Only resolved moment answers are returned. Payloads omit raw metadata, storage keys, sender/recipient IDs and friendship IDs.
- Voice uses authenticated audio delivery and the existing private storage infrastructure. Message upload purpose permits social voice messages during check-in cooldown while preserving upload validation and pending-object expiry.
- One unread message notification per recipient/contract points at the newest message. Opening loaded incoming entries marks only their notification targets read; reading an older target cannot clear a newer message. Message visibility waits for notification persistence to avoid read/notification races.
- Home social presence includes incoming message discovery and bounded recent message previews without crowding out state events. Shared payoff and selective local activity acknowledgement remain; acknowledgement is still per account/browser, not cross-device.
- Phone conversations hide the bottom navigation while the composer is in use. Visual viewport sizing keeps it above the keyboard, with 16px inputs, safe-area spacing, 44px controls, visible focus and reduced-motion support. Polling pauses in the background and refreshes on foreground return.
- CI adds `check:friend-spaces`, using an isolated real MongoDB 8.0.12 and authenticated Express routes. `mongodb-memory-server-core` is development-only and has no deployment postinstall binary download.
- Validation: production build, changed-file lint error check, circle activity, client payloads, duo activation and server hardening checks. MongoDB tests cover authorization, idempotency, simultaneous manual/message check-ins, 20h caps, voice ownership/expiry/reuse, Voice Tax, explicit hunter proof, two-step recovery, notification targeting/read races, hidden/resolved answers, same-timestamp pagination and ended-contract denial.
- Local browser fixtures cover 320×844, 390×844, 390×600 and 1280×844; light/dark, reduced/normal motion, text delivery uncertainty + retry, actual MediaRecorder capture, authenticated playback, older history, details, reload, return focus and older Activity targets. Activity regression passes all four prior widths/themes. Screenshots inspected. Additional browser checks pass for simulated keyboard shrink, scroll restoration, switching from details to a new Activity target inside the same friend space, and ended-contract composer removal. These are not physical iPhone verification.
- Not verified: physical iPhone/Safari microphone and browser chrome, live two-account delivery, or real object-storage playback. The bundle-size warning remains; the profile hook-name errors were fixed in the cards/wall branch.
- Finish exact-head CI before opening one finished PR. Merge only on explicit user instruction, then verify the exact merged frontend/backend deployments.

Activity/navigation below is merged in PR #80.

### Activity panel + reachable circle navigation

- User supplied real iPhone screenshots: the full-screen Activity drawer had stacked read/delete/open buttons and Voice inbox mixed into the feed; Contracts/Arena links were hard to reach near the top of Home.
- Contracts / Arena now occupy a 44px shortcut row immediately above the three primary tabs on Home, Contracts and Arena. Desktop has equivalent sidebar links. The redundant Home header links are removed.
- Activity opens as a rounded bottom sheet on phones (up to 88dvh), preserving a side drawer on desktop. Its scroll region leaves the footer reachable.
- All / Unread / Voice filters separate old voice notes from current updates. Feed rows group into Today / Yesterday / Earlier, use an unread dot, and expose read/delete through one options disclosure.
- Tapping an update opens Contracts, Arena or After Hours as appropriate; After Hours preserves the existing post or room-event target. Contract notifications now open the exact friend space/event when a contract key is available (friend-space implementation); older notifications fall back to Contracts. Voice notifications open Voice inbox.
- Mark all read and Done are persistent footer actions. New controls have 44px targets, visible keyboard focus, reduced-motion support, and restrained press feedback.
- The dialog uses a body portal; the app behind it becomes inert, keyboard focus is trapped, Escape works after controls disappear, and focus returns to the bell on close.
- Mutations serialize with optimistic rollback. In-flight reads are ignored during writes and settled before revalidation; a failed sync keeps the current feed and offers Retry.
- Existing voice playback and invitation accept/decline remain available.
- Validation: production build, changed-file lint error check, existing circle activity / payload / duo activation checks. Local browser fixtures cover 320px / 390px / 1280px, light/dark, normal/reduced motion, shortcut routing, unread filtering, successful/failed delete, mark-all, Voice, sync retry, After Hours/Arena routing, focus restoration, Escape and keyboard trapping. Screenshots inspected.
- Not verified: physical iPhone browser chrome/safe-area behavior or a live two-account journey. The older validation had three profile hook-name lint errors; these are fixed in the cards/wall branch. The bundle-size warning remains.
- Finish exact-head CI before opening one finished PR; merge only on explicit user instruction.

### First shared payoff + Home activity discovery

- A small **Both showed up** reveal appears inside the existing compact contract card after each participant's first real check-in in Season 1.
- The server derives it from actual check-in events, including text / voice, and shows the sum of those two events' existing Duo XP. It does not grant a new reward.
- Season activation timestamps, pokes, and one person's repeated check-ins cannot complete it.
- The reveal is available for 48h after the second person's first check-in, so old pairs are not celebrated retroactively.
- React / reply opens the existing check-in response controls. The reveal can also be dismissed.
- Home keeps bankruptcy, Wanted, Chaos, debt/recovery, season completion, and open moments ahead of ordinary social updates.
- A fresh shared payoff and unseen partner activity rank above quiet contracts. Equal-priority social updates sort by recency.
- Home fills its three card slots from the sorted circle instead of hiding all quieter contracts whenever one contract needs attention.
- **While you were gone** entries are actionable: opening an entry reveals the exact update on its contract, brings that card into view, and moves keyboard focus to it. A focused contract outside the three-card limit is appended without removing danger cards.
- Compact cards now show both answers on resolved Hot Seat / Split Decision and the outcome of a resolved Double Dare.
- Danger instructions remain visible even when a social moment also exists.
- The old 1.2-second automatic seen timer and global seen timestamp are removed. Opening/dismissing one event acknowledges only that event.
- Acknowledgements are per-account and persist in local browser storage, including through polling/reloads. They do **not** synchronize across devices.
- Activity is bounded to 48h, with up to 30 pulse entries and 12 recent entries per contract. Check-in reactions/replies retain the existing 36h availability window.

### Validation / next checks

- `npm run check:circle-activity` checks selective acknowledgement, reload persistence, account isolation, corrupt/unavailable storage, and expiry.
- `cd server && npm run check:duo-activation` checks real two-person activation, old-season exclusion, text + voice XP, duplicate actions, and payoff expiry.
- Both checks are part of repository CI.
- Browser checks used local fixtures: 320px / 390px / desktop, light + dark, reduced motion, activity routing to hidden contracts, keyboard focus, replies, reload persistence, danger ordering, and resolved answers.
- Production frontend build, production dependency audits, payload checks, and hardening checks passed locally.
- The earlier pass had three profile hook-name lint errors; these are fixed in the cards/wall branch.
- Not verified: physical iPhone behavior and a real two-account MongoDB end-to-end journey.
- Finish exact-head CI before opening the PR. Merge only when explicitly requested, then verify both exact merged deployments.

### After Hours device checklist

1. Create each post type.
2. Verify anonymous Confessions stay anonymous to everyone else.
3. Vote on a Hot Take; the author cannot vote on their own take.
4. Reply once per user; replies cannot branch.
5. Spark transfers exactly 1 Aura and enforces daily / per-recipient caps.
6. Burn deducts only the selected 5 / 10 / 25 Aura.
7. Notes arrive as notifications and do not create a chat thread.
8. Person sheets prioritize interaction; Room Question stays secondary.
9. Check client payloads for private/anonymous identity leaks.
10. Start contract conversion still works for identified participants.

### Landing atmosphere

- Landing hero uses the approved moody red / gold / green atmosphere with a deliberately quiet content corridor.
- Desktop uses the higher-quality bundled artwork exported by `src/features/landing/landingDesktopBackground.js`; do not fall back to the old aggressively compressed desktop WebP for the hero.
- Desktop hero composition is intentionally calmer than mobile: restrained headline scale, wider copy column, and a smaller floating contract preview so the page reads as a product landing page rather than a poster.
- Mobile under 760px keeps `public/landing/hakoware-landing-bg-mobile.webp` with the approved tall tunnel composition around the content corridor.
- Mobile artwork fades before the contract-preview area instead of stretching the portrait image through the entire tall hero.
- Dark mode shows the artwork at near-full strength; light mode keeps the same art direction behind a center readability veil.
- Motion is a very slow background drift and is disabled under `prefers-reduced-motion`.
- Do not change the approved mobile hero while solving desktop-only composition issues.

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

Primary tabs:

- Home
- After Hours
- You

Secondary destinations:

- Contracts — reached contextually from Home / contract management
- Arena — reached contextually from Home or exposed contract states

Product rule: **primary navigation is for places users habitually live; systems are contextual.** Do not restore Contracts/Arena as bottom tabs without evidence that the 3-tab model is failing.

### After Hours

After Hours is Hakoware's public stranger-social layer. It is intentionally **not** a dating flow, profile browser, life sim, task board, or generic chatroom.

Current product rule:

**People create the entertainment. Aura gives it weight.**

The room should be interesting even when a user has no task to complete and earns nothing for opening it.

Current product shape:

- the **feed is the room**; people and what they say/do are the primary surface;
- only users who actually enter count as present;
- honest live presence expires after roughly 5 minutes; do not fake users or activity;
- real room activity remains visible for roughly 3 hours so the room still has residue with a small userbase;
- the primary expression modes are:
  - **Shout** — say something;
  - **Hot Take** — post a take the room can judge with `real / nonsense`;
  - **Confession** — public or anonymous;
  - **Ask** — user-created question for the room;
- posts can receive the fixed Hakoware reaction set;
- social posts support **one-level public replies** only:
  - one reply per user per parent post;
  - no reply-to-reply;
  - no infinite threads;
  - anonymous confession owners cannot reply to their own anonymous confession because that would reveal identity;
- people can send an **Aura Spark** to a post or reply:
  - 1 Aura moves from sender → author;
  - no minting / faucet behavior;
  - one Spark per person per item;
  - daily sender cap;
  - per-recipient daily sender cap;
  - anonymous confession Spark notifications/ledger copy must not reveal the author to the sender;
- users may optionally **Burn Aura** on their own post for spectacle:
  - fixed values only: 5 / 10 / 25 Aura;
  - burned Aura is destroyed, not transferred;
  - burning changes presentation only, not ranking/reach;
- basic posting/replying/reactions remain free;
- do **not** add “complete X After Hours actions for Aura” quests;
- the rotating Pick a Side mechanic remains available only as a compact **Room Question**; it no longer defines the page and its ANSWER/CALLOUT activity is not mixed into the main social feed;
- Challenges remain optional one-shot room objects, not the central retention mechanic;
- tapping a real identified person opens a lightweight interaction sheet:
  - recent non-anonymous After Hours activity;
  - **Leave a note** (short, rate-limited, no message thread);
  - contextual Tag in;
  - Start contract;
- Leave a note is not DM:
  - max 60 chars;
  - delivered as a notification;
  - sender→recipient cooldown;
  - no inbox conversation thread;
- when somebody answers your old-style Challenge, Start contract can still appear contextually on that interaction;
- After Hours → contract opens the existing contract flow with username prefilled and records `source: AFTER_HOURS` only when the backend verifies both users were recently in the same scope;
- test / Founder Lab users remain isolated from the live room;
- public room payloads use usernames/display names/public activity IDs rather than raw user IDs;
- old room data is TTL-cleaned;
- no unrestricted stranger DMs;
- no follower system;
- no swipe/match/dating language;
- no fake city, house, or life-sim layer;
- no algorithmic creator economy;
- no fake crowd/bots.

Retention principle:

**A successful After Hours session can be pure spectating.**

Users should be able to open the room, read funny/weird/dramatic posts, recognize recurring people, see reactions/replies/Aura Sparks, and leave without being pushed into an objective.

The conversion path should feel earned:

**see someone repeatedly → react/reply/note → recognize them → eventually Start contract**

Do not make Start contract the first or loudest interaction with a stranger.

The question to validate is now:

**Will users open After Hours because they are curious what people are saying, then gradually form recurring social familiarity that converts into contracts?**

### Avatars

- every account can add, change, or remove an avatar from **You**;
- the client center-crops and compresses the selected image to a 512×512 JPEG before upload;
- the server caps upload size and only accepts JPG, PNG, or WebP with matching magic bytes; SVG is intentionally not accepted;
- avatar objects use the existing Railway/S3-compatible private bucket infrastructure;
- avatar object keys never enter client payloads;
- public delivery uses the username avatar endpoint plus a cache-busting version in the user avatar URL;
- shared `UserAvatar` rendering is used across profile, app chrome, contracts, After Hours, live bounties, and the Shame Board;
- initials remain the fallback if a user has no avatar or an image cannot load.

Founder tooling:

- `/founder`

Current product direction remains **clarity, interaction quality, activation, and retention**, with one deliberate expansion: After Hours is being tested as a public stranger-social layer so Hakoware has something alive to enter when existing contracts are quiet.

Do not respond to retention problems by spraying unrelated mechanics across the product. Expand After Hours only when the live-room behavior earns it.

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

Friction rules added in the social-conversion pass:

- Home exposes **All contracts** and **Arena** as contextual destinations instead of permanent primary tabs;
- the first pending contract can be accepted directly from Home; users should not be forced into Contracts just to press Accept;
- first-time invite acceptance also happens directly on the activation card.
- a brand-new user with no contracts gets two activation paths on Home: **Start a contract** or **After Hours**; do not force “bring a friend first” now that stranger discovery exists;
- the old three-item onboarding rail is compressed to one short rule line.

### Previous compact contract card variant (retained inside friend-space details)

Before the current friend-space implementation, Home and the Contracts page used the **same reference-style compact horizontal contract card** inspired by the approved visual reference.

Locked anatomy:

**large avatar → name + one-line state → compact chips → Duo XP bar → circular action cluster**

Rules:

- the person should dominate the card visually;
- keep the faint Orbit motif as background identity;
- normal/clear contracts stay compact and do not grow into explanatory panels;
- contract type, current season day, and season number are small chips;
- Duo progression is visual first: thin bar + current / next XP;
- primary/secondary/settings actions are circular icon buttons on desktop and remain compact on mobile;
- important states such as Chaos, Wanted, bankruptcy, recovery, season completion, or live social moments may add one restrained expansion row;
- partner check-in reactions/reply stay collapsed until the social action is opened;
- the display-name sparkle/star has been removed; identity should stay clean and let state/accent carry the visual character;
- **do not apply this card skin to After Hours, Arena, You, or notifications**;
- Contracts keeps its surrounding management sections (pending, waiting, summaries), but active contracts use the same compact reference card as Home.

The goal is less copy and faster scanning, not hiding consequential state.

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

Check-in friction rule:

- vibe + tiny note are truly optional; no vibe is preselected;
- opening the modal and pressing **Check in** is a valid one-action path unless a real bounty/proof decision requires more input.

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

Arena friction rule:

- Arena is secondary navigation, not a permanent bottom tab;
- hide the dead `No bankrupt targets` CTA when the user cannot place a bounty;
- only show target search when the live bounty list is large enough to need it;
- keep Arena intro copy compressed; the live objects should explain the system.


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

### Arena card language

Arena now borrows the **person-first hierarchy** of the compact contract reference without literally reusing the contract card.

Bounty targets:

**large target avatar → identity + danger state → one-line context → funding/hunt metadata → bounty value + one compact action**

Rules:

- the target/person is visually primary;
- bounty value and funding breakdown are compact, not separate explanatory boxes;
- Hunt / Pressure are the only strong CTAs when available;
- owner/partner/hunted states become small state controls instead of extra panels;
- Wanted / hunting / proof states may tint the card, but should not create nested containers;
- mobile keeps the avatar + identity first and moves reward/action beneath the content.

Public Grudges inside Arena use paired identities:
- victim is the larger avatar;
- claimant is the smaller overlaid avatar;
- show only claimed Aura, remaining time, and the bankruptcy condition;
- no paragraph explaining the entire Grudge system.

Do not apply this Arena card treatment to After Hours or notifications.

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

### Personal Grudge cards

The Grudge section is a concrete exception to the general “leave You alone” rule because the old version was sentence-heavy and action-state was hard to scan.

Current anatomy:

**other person's avatar → name + Grudge state → one-line history → timer/condition → Aura amount + one action**

Rules:

- always anchor the card on the **other person**, not “A vs B”;
- victim view says what they took from you and whether revenge is open;
- claimant view says what you took and reminds you to stay solvent;
- only show **Return the Favor** when revenge is actually ready;
- if revenge is not ready, use a quiet state such as `Waiting on them`, not a disabled full CTA;
- public avatar URLs may be included in the safe Grudge payload, but never expose raw participant IDs just to render identity.

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

## 21. Recent merged / open PRs

Older security/gameplay PRs #53–#60 are still part of the baseline described throughout this file.

Most relevant recent sequence:

### PR #61
First-duo activation fix: first check-in is immediately available after season activation and only real in-season check-ins trigger the 20h gate.

### PR #67
Hot Seat prompt variety / anti-repeat selection.

### PR #68–#71
Landing atmosphere + light mode + artwork fixes + desktop hero refinement.

### PR #73
After Hours v2 + avatars:
- feed-first room;
- real presence/residue;
- Shouts;
- custom Challenges;
- reactions;
- Tag in;
- avatar upload/display pipeline.

### PR #74
Social conversion + friction pass:
- primary nav reduced to Home / After Hours / You;
- After Hours person sheet + Start contract conversion;
- server-verified `source: AFTER_HOURS`;
- contract creation compressed;
- direct Home invite acceptance;
- optional check-in vibe;
- Arena friction cleanup.

### PR #75
Home contract cards changed to the approved compact reference-style layout.

### PR #76 — merged
The same compact contract-card layout now renders on the Contracts page. Decorative display-name star removed.

Merged SHA:
`0fcc9541b29c5a2aa47f0c14386969825e9310e4`

### PR #77 — merged
Arena targets + public/personal Grudges moved to the cleaner person-first visual hierarchy.

Merged SHA / current main before #78:
`43908fb9e769273c6a20069c351e3ae65a6a72a2`

### PR #78 — merged
`Turn After Hours into a social room with Aura`

Branch:
`feat/after-hours-social-aura`

Merged SHA: `a5189133b778ea9ff0d99ab5af2e6f3cd81e8631`. It contains the Shout / Hot Take / Confession / Ask social model, one-level replies, Aura Spark, Aura Burn, interaction-first stranger sheet, and the demoted Room Question.

The exact merged frontend/backend deployments were verified successful on 2026-10-02. Continue from the current checkpoint at the top of this file.

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

Current branch rule reaffirmed: implementation + diff audit + exact-head CI must be complete **before** opening the PR.

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

After Hours adds a second funnel worth measuring:

**room interaction → Start contract → accepted contract → first mutual check-in**

`CONTRACT_CREATED` events created from the room carry `source: AFTER_HOURS` so that conversion can be separated from direct contract creation.

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
- Hot Seat uses a broad prompt bank and anti-repeat selection: avoid the contract's last 12 Hot Seat prompts and the platform's most recent 18 prompt IDs, then bias toward globally least-recently-used prompts; both sides of the same Hot Seat still receive the same prompt by design;
- timed moments are scoped to the current season and removed when the contract ends;
- Home prioritizes open Hot Seat / Mutual Menace states above ordinary clear contracts;
- when Hot Seat opens, the worker creates in-app notifications for both players;
- social presence also revalidates every minute while the app is foregrounded and immediately when the app becomes visible again.

Retention rule:

**A starts something → B discovers/responds later → A has a reason to come back for the outcome.**

Do not add a prediction/wager mechanic.

Product rule:

**one meaningful progression action per day, many tiny social responses throughout the day.**

The user has now explicitly authorized persistent conversations inside accepted contracts (see current friend-space checkpoint). Do not add followers, another public social feed, stranger DMs or notification spam. The older check-in reply remains a bounded legacy interaction within Contract details.

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

