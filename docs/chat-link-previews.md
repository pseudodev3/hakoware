# Chat link previews and actions

Duo messages, check-in replies and mutually accepted connection chats now linkify explicit HTTP(S)/www links. The first link gets a compact title, description and optional image when its bubble enters the viewport. Sending a message never waits for a remote website. Missing metadata or an unavailable site leaves the original clickable text intact. Authenticated pages and JavaScript-only sites may not provide previews.

`POST /api/chat-links/preview` accepts `{ kind: "duo" | "connection", messageId }`. `POST /api/chat-links/image` also requires the returned `imageVersion`. Neither accepts a caller-supplied URL. Both authenticate the saved message and current participants, scope and blocks before serving cached content; access is checked again after remote I/O. Responses are private/no-store. Images travel through the authenticated API into temporary blob URLs, which are revoked on unmount.

Outbound requests accept public HTTP(S) on default ports only. DNS answers are checked and pinned to the connection; every redirect is validated, including downgrade protection. No cookies, authentication or referrer are forwarded. Known token/invitation/private app URLs are skipped. Fetches have a 6.5-second deadline, redirect and compressed/decompressed byte limits, four concurrent slots and a bounded queue. Images are restricted to JPEG/PNG/WebP and capped by bytes and dimensions. Metadata is rendered as React text, never HTML.

Caches live in process memory: at most 512 page entries, 48 images/12 MiB, and 512 image-failure entries. Successful results expire after 24 hours; failures after 10 minutes. The browser retains at most 256 cached message previews per session. No database collections, secondary indexes or uploaded media storage are required, including on Railway trial storage.

Shared buttons, primary game actions, card actions, landing CTAs and chat send controls use `src/shared/components/Button.css`. Feature styles retain layout and intentional selection states. Keyboard focus, touch targets, disabled/loading states and reduced motion remain supported. Old duplicated primary button rules were removed.

## Validation

- `npm run check:chat-links` verifies linkification and text preservation.
- `npm run check:chat-links --prefix server` checks private-address rejection, DNS pinning, redirects, compressed limits, metadata parsing, saved-message authorization, hidden messages, test-account scope, blocks during fetch, request coalescing and authenticated image delivery/fallback.
- Existing friend-space, people, security/scaling and session-boundary checks pass. Production build and lint pass; lint retains repository warnings.
- Chromium browser checks exercised both real chat APIs against disposable MongoDB, with controlled remote metadata/image fixtures, at 320px/light, 390px/dark and 1280px/dark. Sending, image loading, fallback links, scroll position and touch targets passed. Landing signup/demo controls, keyboard focus and reduced motion passed at 320, 390, 768, 981 and 1280px in both themes. A full four-player round and bank confirmation/shop dialogs also passed with the new controls. Native iPhone/Safari was not tested.

A direct public-site fetch from this cloud workspace could not resolve DNS (`EAI_AGAIN`). Outbound transport safety and UI behavior were verified with controlled DNS/HTTP and metadata fixtures; external website fetching on Railway still needs a deployment check.
