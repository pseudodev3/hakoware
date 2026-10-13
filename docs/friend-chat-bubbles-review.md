# Friend chat bubbles

Friend messages now use soft speech bubbles with curved tails instead of outlined panels. Incoming bubbles use a neutral surface; outgoing bubbles use the shared Duo color with dark text. Consecutive messages from the same person within five minutes sit together, with a tail on the last message. Sender changes, shared events, and date boundaries separate groups.

Timestamps and sent/read ticks sit beside the final line where space permits. Longer text wraps without overlapping its timestamp. Voice messages keep their own metadata row and accessible playback controls. Sending and unconfirmed-delivery bubbles retain their existing retry behavior. Check-in explanations remain readable against the new outgoing colors.

This change is limited to FriendSpace presentation. Message requests, read acknowledgement, drafts, retry keys, check-in rules, and storage remain intact. No new cards or media assets are added.

## Verification

- Production build and whitespace checks pass. The touched component has zero ESLint errors and its existing twenty JSX unused-variable warnings.
- Chromium previews use the real FriendSpace component with synthetic responses: 320, 390, and 1280 pixels in both themes pass without horizontal overflow, timestamp overlap, or unexpected JavaScript errors.
- Short texts, multiline and long unbroken text, emoji, voice and unavailable-audio bubbles, shared events, sender grouping, the five-minute gap, and accessible sent/read labels are checked.
- All six Duo colors meet a 4.5:1 contrast ratio for outgoing body text and timestamps in both themes.
- A simulated interrupted send shows the pending and retry states. Retrying reuses the same request key, leaves one delivered bubble, and clears the draft.

These are local browser checks with mocked network responses; no accounts or database records were created. Production deployment and physical-device keyboards are outside this check.

## Review images

- [Chat on mobile in dark mode](friend-chat-bubbles-evidence/chat-390-dark.png)
- [Chat at 320 pixels in light mode](friend-chat-bubbles-evidence/chat-320-light.png)
- [Clay Duo bubbles](friend-chat-bubbles-evidence/chat-clay-390-dark.png)
- [Unconfirmed delivery and retry](friend-chat-bubbles-evidence/retry-390-dark.png)
