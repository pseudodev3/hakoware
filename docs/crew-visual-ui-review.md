# Textured crew cards — UI review

Selected direction 2 turns Home into a featured friend plus two neighboring crew cards, keeps Circle as a compact roster, gives friend conversations one identity header, and brings actual After Hours posts earlier. Public Sans, original tool art, actual social state and existing progression/economy rules remain.

The material is raster ink grain with fine cut-corner edges, a wordless H watermark and a small lime accent. Colors stay semantic: lime for selected/actions, violet for After Hours, gold for Aura, red for danger. Light mode uses paper and ink, with subtle material opacity.

## Visual evidence

[Source and implementation comparison](crew-visual-evidence/home-reference-comparison.webp), [Home full scroll](crew-visual-evidence/home-dark.webp), [conversation](crew-visual-evidence/conversation-dark.webp), [After Hours](crew-visual-evidence/after-hours-dark.webp), [light initial fallback](crew-visual-evidence/home-light-fallback.webp). The combined image places the normalized source left and actual application right at 390px. Portraits in photo-filled review renders are synthetic concept crops provided only by the local fixture harness. Production uses existing avatar data and initial fallbacks.

See the complete comparison criteria, deliberate size adaptations and resolved P1/P2 issues in [design-qa.md](../design-qa.md). 44px controls and16px preview text increase density relative to the small generated mock labels; Home scrolls instead of reducing touch/text size. All friends, Arena and After Hours remain reachable through the existing dock/sidebar.

## Behavior preserved

- Home ordering preserves dangerous contracts ahead of messages and messages ahead of ordinary mechanics. Cards show actual message previews and honest mixed update labels; only exact latest MESSAGE IDs already shown are omitted from supporting activity. Older/off-card updates, invitations, moments/payoffs and full Circle remain accessible.
- The shelf uses real owned/reserved copies and actual Aura, preserves original artwork and exact incoming-offer navigation. It does not seed illustrative cards or reward counts.
- Conversations retain send/read/focus/history, uncertain retry keys, drafts edited during delivery, manual check-in, voice and Contract details. Successful check-in acknowledgment sits below the message text.
- After Hours preserves 48h social replies, 3h challenges/conversion, exact Activity destinations, browser Back, stable retry UUIDs, paged replies, pending freezes, expiry snapshots, public/anonymous-owner rules and all existing Aura actions. People now have a compact presence launcher and a sheet that returns from person details.
- Shared Input label/error IDs and generic Modal keyboard/inert/return-focus handling repair confirmed gaps in the new Add friend path. Its initial input focus is scheduled by Modal to preserve the actual launcher. After Hours keeps its dedicated exact-target wrapper. Closed generic Modal instances no longer overwrite an active dialog's body scroll lock.

## Validation

Final local source: production build; full lint with zero errors (existing unused-variable/hook warnings remain); three circle activity checks; frontend/backend production audits report zero vulnerabilities. Existing bundle-size warning remains. No package manifests, dependency lockfiles, backend or economy changes.

Chromium fixtures cover 320×600,390×600,390×844 and1280×844, dark/light and motion preferences. Review checks loaded Public Sans, no horizontal overflow, contained names/avatars,44px primary controls, 16px composer/input text, exact Back focus, Activity access, contract toggles, real shelf destinations and empty/broken states. Separate room and integration reports cover the preserved flows above; evidence is in `/workspace/shared/hakoware-crew-*`.

Generic modal checks include Add friend on coarse 320 and fine 390 pointers, label-click focus, Step 1→2→Back, Tab/ShiftTab wrapping, background inert, active scroll lock, Escape and exact launcher restoration. Check-in and After Hours dialogs have independent smoke checks. Arena/profile were checked for navigation and shared-token effects; their remaining pre-existing control-size issues are outside this visual pass.

Exact published-head GitHub validation and Vercel preview must pass before opening the finished PR. Merge only on explicit user instruction; then verify exact main deployments.

Limits: fixture tests are not live authenticated two-account delivery or physical iPhone/Safari/microphone tests. Real retention cohorts were not inspected. This visual pass does not implement the proposed duel or claim retention has been fixed.

## Asset provenance

| Production asset | Generated source | Delivered size |
| --- | --- | --- |
| `public/textures/hakoware-ink-grain.webp` | `/workspace/generated_images/exec-93a1bd74-5f4b-44dd-b6b2-871aeffb8a0e.png` | 1254×1254; 115422 bytes |
| `public/textures/hakoware-crew-mark.webp` | `/workspace/generated_images/exec-3aba1299-e57e-4e9d-b400-d5c8c71d406f.png` | 320×320 alpha; 26388 bytes |
| `public/textures/hakoware-crew-accent.webp` | ImageGen decorative lime accent, original preserved in `/workspace/generated_images/` | 128×128 alpha; 3958 bytes |

Original generated files are preserved outside the repository. Standard raster sizing/compression prepares web delivery; no uncompressed 1.3MB duplicate is shipped. Review screenshots live only under docs and are not loaded by the app.
