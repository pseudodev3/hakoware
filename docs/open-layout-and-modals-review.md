# Open layouts and clearer dialogs

Home message previews and card shelves, ordinary Circle conversations, Duo details, completed exchange history, empty states, and landing-page feature descriptions now use open space and fine separators. Unread or urgent conversations, featured Duos, live offers, invitations, collectible cards, and game highlights keep their containers.

The landing navigation is a flat header across the top of the screen with aligned inner content, a quiet divider, and working login, signup, and theme controls. Scrolling to a landing section leaves room for the fixed header.

Dialogs have clearer titles, more breathing room, and titles that wrap. Shared dialogs adapt to the visible mobile viewport as the keyboard opens. Check-in has readable debt/context text, 44px status choices, a clear note field, an inline error, and fixed action buttons. Notes and vibes survive a failed submission, and dismissal is blocked while submitting. Voice and bounty controls have readable labels and contrast in both themes; the pressure-move dialog now has its own layout. Closing voice check-in stops recording, clears the timer/audio, revokes its preview URL, and discards a microphone request that finishes after dismissal.

The production build, all eleven frontend checks, and whitespace checks pass. ESLint reports zero errors and 393 warnings under the existing configuration. Chromium reviewed 200 viewport/theme views across 320, 390, 768, and 1280 pixels with no horizontal overflow or unexpected browser errors. Checks cover the landing demo/auth controls, card details and offers, Circle, bank, profile and Duo editors, Sparks empty/composer states, and modal focus return. Focused checks cover a long title, a 340px simulated keyboard viewport, Escape/focus trapping, viewport listener cleanup, no-visualViewport fallback, failed check-in recovery, a real successful check-in retry, bounty affordability, pressure choices, and the recap. Microphone cleanup checks use Chromium's fake device to verify recording, delayed permission completion, reopening, duplicate-start prevention, and preview URL cleanup.

Stress views use read-only response overrides for long names, Chaos/recovery/pressure, bankrupt partners, completed-season navigation, and voice eligibility. Keyboard behavior was simulated; physical keyboards and production rollout have not been verified. Bank and game rules, card prices, and Sparks storage guards are unchanged. Disposable local accounts and their records were removed after review.

- [Flat landing header](open-layout-evidence/landing-1280-light.png)
- [Open landing feature sections](open-layout-evidence/landing-features-1280-light.png)
- [Home](open-layout-evidence/home-1280-dark.png)
- [Circle after reading conversations](open-layout-evidence/circle-read-390-light.png)
- [Check-in on mobile](open-layout-evidence/checkin-390-light.png)
- [Check-in with a small keyboard viewport](open-layout-evidence/checkin-keyboard-320-light.png)
- [Voice preview](open-layout-evidence/voice-recording-ready-390-light.png)
- [Pressure choices](open-layout-evidence/pressure-editor-390-light.png)
