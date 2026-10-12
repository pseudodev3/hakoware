# Main app editorial redesign

The signed-in app now uses the chosen bold editorial direction: large, readable headings, warm dark surfaces, lime navigation accents, quieter metadata, and consistent spacing. Conversations lead Home; the next useful action and collection sit beside them on desktop. The existing landing and activation flow stays in place.

## Screens and behavior

| Surface | Change |
| --- | --- |
| Navigation | Clear active destination, short destination descriptions, a working home logo, and a compact mobile dock. |
| Home | Conversation previews and people come first. Exact return guidance continues to open the relevant message, recap, moment, or check-in. Pending social data shows a loading message instead of falsely offering a first message. |
| Circle | Invitations and the roster share the same hierarchy, with a visible new-Duo action and readable empty states. |
| Conversations | A single integrated header, readable message bubbles, a fixed composer, voice controls, and an explicit contract disclosure. Existing timeline loading, retries, private audio, and message/check-in behavior remain. |
| Arena and collection | A consistent heading and keyboard-operable tabs. Purchases, owned copies, reserved trades, offers, and the existing bounty/grudge/shame actions remain available. Home distinguishes owned tools from available catalog previews. |
| After Hours | The room feed, presence, and composer use the same visual system. Post/reply links, draft recovery, room dialogs, expiry windows, and challenge mechanics remain. |
| You | Profile, Aura progress, strongest Duo, privacy, and ledger have a clearer hierarchy. Avatar upload/removal, sharing, Grudges, revenge, collection navigation, and sign-out remain. |

## Legacy cleanup

- Replaced `ContractCard` with `ContractDetails`, retaining the mounted contract view and removing its unreachable alternate renderer and unused presentation props.
- Removed the duplicate profile inventory UI and its extra catalog request. All four active tools are managed through the existing card collection.
- Removed the speculative Hakoware+ teaser and its unused artwork export from the profile.
- Replaced accumulated layout, conversation, contract, Arena, and profile style layers with canonical styles; removed obsolete global hero selectors and redundant initial portraits/KPI presentation.
- Kept backend endpoints, owned collectibles, balances, transaction rules, and compatibility notices for retired wall links. No dependency or backend changes are included.

## Verification

- Production build, import-resolution check, and `git diff --check` pass. ESLint reports zero errors; warnings remain under the repository's current configuration.
- All 11 frontend checks pass: three circle-activity checks and eight activation/return checks.
- All seven backend regression scripts pass: client payloads, server hardening, Duo activation, friend spaces, After Hours social, cards/wall, and card purchases. Production dependency audits report zero vulnerabilities for client and server.
- Local Chromium rendered all five primary screens, conversations, and contract details at 320, 390, and 1280 pixels in dark and light themes: 42 cases, including reduced motion, with no horizontal overflow or browser errors.
- Real local-service browser flows pass for messaging, contract reactions/replies, Activity focus restoration, card purchase/use/trade acceptance, keyboard tabs, room posts/replies and exact links, retired-wall link recovery, privacy changes, avatar upload/removal, and collection navigation.
- A simulated microphone recording passes recording, upload, committed delivery, authenticated recipient audio retrieval, and recipient playback. Playback has a 44-pixel target at 320 pixels. A delayed social response verifies the pending state recovers to real conversation previews.
- The prior landing/onboarding browser suite passes again, including signup/login destinations, the demo, mode carry-through, invitations, both first check-ins, and return guidance.

The disposable local accounts, their contracts, activity, and voice object are removed after verification. Full captures and browser harnesses remain in `/workspace/hakoware-dev/main-app-evidence/verified` and `/workspace/hakoware-dev`. These are local-service checks; physical-device keyboard/microphone behavior and production deployment are outside this verification.

## Review images

Captured fixture balances and activity are test data. These images show the final implementation, not a pristine before/after comparison.

- [Home desktop, dark](main-app-editorial-evidence/home-1280-dark.png)
- [Home mobile, dark](main-app-editorial-evidence/home-390-dark.png)
- [Arena desktop, dark](main-app-editorial-evidence/arena-1280-dark.png)
- [After Hours desktop, dark](main-app-editorial-evidence/afterHours-1280-dark.png)
- [Profile mobile, light](main-app-editorial-evidence/you-390-light.png)
- [Conversation mobile, dark](main-app-editorial-evidence/conversation-390-dark.png)
- [Contract at 320 pixels, light](main-app-editorial-evidence/contract-320-light.png)
- [Voice playback at 320 pixels, dark](main-app-editorial-evidence/voice-320-dark.png)

The redesign makes the existing return loop easier to see and use. Any improvement in signup, mutual activation, or return visits still needs the cohort measurement described in [the activation review](activation-return-ui-review.md#retention-measurement).
