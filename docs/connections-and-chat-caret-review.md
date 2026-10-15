# Connections avatars, theme control and chat input

The accepted-connection row applied `flex: 1` to every direct child span, including `UserAvatar`. Its decorative frame stretched into an oval. Only the named copy column now grows; image and initial avatars retain their square dimensions and circular frames in both accepted and pending rows.

Desktop retains the sidebar appearance switch. The duplicate header control and its unused CSS are removed. Mobile keeps appearance switching in the account sheet.

The friend-space textarea no longer resets its inline height to `auto` and back on each keystroke. An invisible CSS grid mirror supplies multiline height, using identical padding, font, wrapping and border-box sizing. The real textarea keeps native selection, scrolling, editing, emoji insertion and its existing message limit. Long drafts stay capped, including while the keyboard is open. Friend spaces also skip the translated entrance animation so their focused input has no moving ancestor.

Keyboard detection now retains the unobscured height, accounting for installed iOS apps that shorten both `innerHeight` and `visualViewport.height`. Resize, pan and focus events are coalesced; unchanged geometry is not rewritten. Pinch zoom remains untouched, orientation changes reset the baseline, and leaving chat clears listeners, pending animation frames and inline viewport sizing.

## Validation

- Production build/prerendering and lint pass; lint has zero errors and existing warning classes.
- Three viewport regressions cover simultaneous viewport shrink, pan, focus/blur, orientation, pinch zoom, duplicate events and leaving chat with a pending update.
- Browser checks at 320px, 390px and 1280px in both themes verify image/fallback/pending avatars remain 34px square, one available appearance control, appearance switching and person options. Chat checks cover native selection preservation, one-line and multiline growth, scrolling within long drafts, simulated installed-app keyboard resize/pan, context visibility, removal of transformed ancestors and cleanup. No overflow or runtime errors observed.
- Real local APIs and disposable MongoDB verify sending and link previews in both Duo and connection chats at mobile and desktop sizes, including staying in history and following newly loaded previews. No production records are used.

Physical iPhone/Safari caret rendering cannot be reproduced by Chromium's simulated keyboard. The sizing and viewport changes need confirmation on the user's phone after deployment.
