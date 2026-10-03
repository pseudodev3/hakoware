# Cards and weekly wall review

The collection follows the original Aura Market artwork and dark mini-stages. The user rejected outline-icon badges; those are removed. Original Clean Slate, Claim, Signal Flare and Chaos Ticket assets are unchanged. New wall marks use matching shaded metal/enamel artwork, packed into one 242 KB WebP sprite sheet. Labels and owned/reserved counts stay in accessible HTML.

| Before | After | Why |
| --- | --- | --- |
| Four purchase tools in You, separate from Arena | Twelve-card collection and offers in Arena, linked from You | Puts collection, use and exchange in one reachable destination |
| Initial outline badges on generic gallery cards | Existing shaded object artwork and dark mini-stages; matching new collectible objects | Follows Hakoware’s established art direction and the user’s correction |
| Arena opens on an empty bounty board for quiet circles | Cards first; Bounties, Grudges and Shame remain one tap away | Gives a person something usable when nobody is bankrupt |
| After Hours contributions disappear with the short-lived room | Weekly wall with sketches, notes and reusable stamps; Room remains available | Leaves shared work to return to asynchronously |
| Full-wall overlap can bury another mark | Browse marks sheet, author details and targeted Activity links | Keeps every contribution reachable without rearranging other people’s work |
| Drag-only positioning | Drag, keyboard arrows and 44px move controls; only an author edits their work | Supports touch, mouse and keyboard with the same permission rules |
| Modal/footer reach and retry uncertainty | Native inert modal, explicit focus wrap/restore, scrollable body and reachable footer; stable retry keys | Prevents stray taps and duplicate purchases/contributions after an uncertain response |
| Global reduced-motion active rule removes a positioned button’s transform | Wall pieces preserve their positioning transform while other motion is reduced | Keeps a pressed mark from jumping away from the finger |

Validation: production build; full lint with zero errors; production dependency audits; server syntax; payload, mutual activation, circle acknowledgement and hardening checks; real MongoDB friend-space and card/wall integration checks. Existing bundle warning and legacy AfterHoursSpark duplicate-index warning remain.

Browser fixtures exercise the full app at 320×844, 390×844, 390×600 and 1280×844, with light/dark themes and reduced/normal motion. They cover uncertain purchase and wall-save retries, offer creation/cancellation/acceptance, sketch/undo/stroke bounds, reusable stamping, overlapping-mark selection, drag/arrow moves, author permissions, read-only archives, reload persistence, exact offer/wall/post/bounty Activity links, profile collection navigation, focus wrap and sheet footer reach. Backend tests independently verify actual authenticated persistence and concurrent card exchanges; browser fixtures are not a live two-account service test.

Before screenshots were captured from isolated main `4014156aa0b138c16297cb5629c99fe61abdeb99`. Local after screenshots live under `/tmp/hakoware-cards-*`, `/tmp/hakoware-card-marks-*` and `/tmp/hakoware-wall-*`; before views under `/tmp/hakoware-arena-before-*` and `/tmp/hakoware-after-hours-before-*`. The artwork source is in `src/features/profile/marketArt.js`; the new sprite asset is `public/cards/wall-marks.webp`.

Physical iPhone/Safari browser chrome, keyboard and drawing interactions still need device verification. Retention impact has not been measured.
