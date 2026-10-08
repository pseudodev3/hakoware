# Crew visual revamp — design QA

Final result: passed.

## Brief and comparison method

The user selected direction **2 — textured crew cards** to guide the visual revamp of Home, friend conversations and After Hours. This is the existing Hakoware application, with real product states, rather than a standalone mockup clone.

Reference: `/workspace/generated_images/exec-3229aa87-3e3f-447e-98cb-50a3ca67de1e.png`, 853×1844. Normalize its width to 390 CSS pixels (scale 390/853=0.45721), producing 390×843. Compare with the actual application at 390×844, Chromium device scale 1. The one-pixel height difference is rounding; no phone/browser frame is included. The reviewer inspected the source and implementation together in the combined image, then inspected full scroll, small-screen, light-theme and desktop captures.

[Combined comparison](docs/crew-visual-evidence/home-reference-comparison.webp): **reference left, rendered application right**. It is a review artifact; its portraits are synthetic crops from the generated concept, supplied only through intercepted local fixture APIs. They are not application assets or production account data.

## Checks against the source

| Category | Finding and outcome |
| --- | --- |
| Typography | Public Sans is the sole application font, verified as loaded in every root capture. Home title 42.9px at 390, strong friend names, 16px conversation and card-preview text, quieter timestamps/Duo state. Ordinary featured names wrap to two lines; full names/previews remain available to assistive technology. |
| Spacing and rhythm | Removed redundant Conversations/Open circle heading and duplicate populated-Home Add friend button. Featured card starts at174px rather than the first implementation's 246px. Normal phone featured card is 222px. Two adjacent friends lead into the real collection shelf; safe dock/composer space is preserved. Portraits cannot determine the desktop card's intrinsic height. |
| Colors and surfaces | Near-black ink, cream text, lime actions, blue/violet neighbor edges and violet After Hours surfaces follow the selected direction. Actual raster grain is composited separately from semantic backgrounds; light mode keeps paper surfaces and readable ink. Danger/Aura/healthy colors retain their established meanings. |
| Imagery | Actual user avatars fill the portrait regions; broken/missing photos use intentional initials with the same hierarchy. Generated grain, H watermark and tiny decorative lime accent are lightweight raster assets. Collection art reuses the existing shaded objects. No invented live people, stock avatar replacement or fabricated owned cards. |
| Copy and content | Actual last messages, mixed New updates, real time/Duo/contract state and separate check-in/recap. Inventory, reserved copies, Aura and incoming offers come from existing services. “Social posts ·48h” scopes the expiry copy correctly; challenges retain 3h. The mock's extra marketing slogan is omitted. |

The selected image is a visual direction, not a literal production-data specification. Deliberate adaptations: keep Activity in the header; preserve every existing destination; use actual avatars/inventory and initial fallbacks; use 16px preview text and 44px controls rather than the mock's smaller labels/actions. This increases card height and lets the collection scroll below the first phone viewport. Desktop uses a bounded content rail with the existing sidebar. Conversation and After Hours inherit the selected material/type/edge system; the source only depicts Home.

## Issues resolved during iteration

| Severity | Location | Before | Fix and recheck |
| --- | --- | --- | --- |
| P1 | Home density | Extra section heading pushed the first friend to 246px. | Removed duplicate hierarchy; final first card 174px. |
| P1 | Light surfaces | Applying opaque dark grain as a background made light cards black. | Isolated low-opacity texture layers; dark/light matrix recaptured. |
| P2 | Featured identity | Arrow reservation truncated ordinary names such as Alexander at 320/390. | Controlled two-line name wrapping, long-token containment, full accessible name; six name cases pass. |
| P2 | Desktop portrait | Intrinsic image height enlarged the featured card and left unused space. | Absolute portrait fill preserves content-driven card sizing; desktop and phone recaptured. |
| P2 | Shared Input and Add friend | Visible label lacked an association; generic dialog allowed keyboard escape and lost launcher focus. | Stable label/error IDs; named16px input; inert background, Tab/ShiftTab trap and exact return focus. Modal schedules initial focus after capturing the opener. |
| P2 | Dialog implementation | Ref on AnimatePresence's direct native child caused a React warning. | Derive portal root from the nested content ref; clean-console rerun. |
| P2 | Small controls | Toast close 36px, modal close 40/42px and legacy Contract details actions 34/43px. | Close controls 44px; Contract actions scoped to FriendSpace44px; bounds rechecked. |

No actionable P0/P1/P2 issues remain in the reviewed Home, friend-conversation, After Hours and shared-dialog scope. Final recaptures verify the desktop image-size correction, contained phone names, clean console and 44px core controls. The listed accessibility and readability adaptations are intentional differences from the generated direction, not unresolved defects.

## Verification and evidence

Tracked representative renders: [Home](docs/crew-visual-evidence/home-dark.webp), [conversation](docs/crew-visual-evidence/conversation-dark.webp), [After Hours](docs/crew-visual-evidence/after-hours-dark.webp), [light fallback](docs/crew-visual-evidence/home-light-fallback.webp).

Local evidence directories:

- `/workspace/shared/hakoware-crew-root` and `hakoware-crew-fallback`: combined reference, photos/initials, 320×600,390×600,390×844,1280×844; actual font, overflow, DOM and control bounds. Arena/profile captures are navigation/shared-token smoke checks, not a complete audit of those screens.
- `/workspace/shared/hakoware-crew-home-check` and `hakoware-crew-name-check`: both themes, long/broken identities, truthful shelf, moments, priority and navigation.
- `/workspace/shared/hakoware-crew-integration`: Home/Circle/friend/Back, exact Activity target, Contract disclosure, send uncertainty/retry/edited draft/read acknowledgments, modal keyboard/launcher behavior,44px controls and16px inputs.
- `/workspace/shared/hakoware-crew-after-hours`: exact post/reply focus and browser Back, bounded pagination, uncertain UUIDs, pending freezes/drafts, expiry, public/anonymous ownership, people sheets and unchanged Spark/burn/question/challenge payloads. Dedicated After Hours focus and viewport handling remains active through `manageFocus={false}`.

Build, lint, circle checks and production dependency audits are recorded in `docs/crew-visual-ui-review.md`; exact published-head CI must also pass before a finished PR is handed over.

Limits: local intercepted API fixtures, Chromium viewports and synthetic review content do not establish live account delivery, physical Safari/microphone/keyboard behavior or a retention lift. No game, economy, notification-delivery or domain change belongs to this pass.
