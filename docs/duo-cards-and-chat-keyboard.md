# Full Duo cards and chat keyboard layout

The selected Duo palette now fills the entire friendship card. Citron, Clay, Iris, Sky, Rose and Sand use matching dark text, with Orbits, Waves or Rays across the full surface. Read cards retain the design; new updates use their own label instead of replacing every palette with the same green background. The Duo editor and profile preview show the same treatment.

Cover graphics are clipped separately from the card content, preserving avatar frames. Equal-height grid cards fill their available space and keep the footer at the bottom. Linked frames use a darker outline on these coloured surfaces so the ring stays visible against Citron.

The chat previously updated its height when the keyboard opened, but ignored Safari's viewport offset and subsequent pan events. The friend-space shell now follows both the visible height and top offset, listens for resize and scroll, and removes its listeners and inline sizing on exit. Pinch zoom keeps normal browser behaviour. A resize observer follows the latest message, while deliberate scrolling into history preserves that position. Resize-driven scroll events do not change the history/following state.

While the keyboard is open, the header becomes shorter, long drafts scroll within a capped textarea, and the check-in/Poke context row hides. The message box stays at the bottom of the visible conversation. Reply and emoji focus changes use `preventScroll`.

## Verification

- Production build passes; ESLint reports zero errors and 421 existing warnings.
- All 17 frontend activity, next-move and bank-retry checks pass.
- Presentation, friend-space and client-payload suites pass, covering identity ownership, unchanged Aura/XP/rules, private messages, message idempotency, voice ownership and contract progression.
- Chromium checks at 320, 390, 768 and 1280 pixels in both themes cover all six palettes, all three covers, read/unread and featured cards, frame clipping, text contrast, identity preview/save, and conversation actions.
- Simulated keyboard heights of 360, 390 and 210 pixels include a scroll-only pan, multiline drafts, sending, real history scrolling, close/reopen geometry, pinch-zoom handling and listener cleanup. The CSS fallback also works without `visualViewport`.
- Existing chat browser checks pass for receipts, grouping, long text, voice bubbles, all six message colours, failed delivery and a single-message retry using the original request key.

Browser checks use intercepted local fixtures and create no accounts or database records. The keyboard geometry was simulated in Chromium; physical iPhone Safari and the production deployment have not been verified here.

## Review images

- [All six palettes on desktop](duo-chat-evidence/cards-desktop-dark.png)
- [Cards on mobile](duo-chat-evidence/cards-mobile-dark.png)
- [Cards in light mode](duo-chat-evidence/cards-desktop-light.png)
- [Visible chat area with a simulated keyboard](duo-chat-evidence/keyboard-mobile-dark.png)
