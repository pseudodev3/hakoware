# Installed-app spacing and selection — October 14, 2026

The user's installed iPhone screenshots showed chat controls underneath the system status bar. Home already reserved some safe-area space; the independently positioned chat header and notification button did not use the same offset. A Duo-colored top border also appeared at the top of the screen.

## Changes

- Shared `--safe-area-top` and `--safe-area-bottom` values come from the browser's native safe-area environment values.
- Mobile app and chat headers add normal breathing room after the top inset. The bell follows the chat header's normal and compact keyboard positions.
- The Duo color is a subdued bottom divider instead of a line across the status-bar area.
- Landing, signup and legal headers also respect installed-app top spacing. The manifest and dark theme metadata match the application's background.
- The active mobile navigation item uses accent color and stronger type/icon weight without a filled tile. `aria-current` and keyboard focus remain.
- Message arrival highlights sit inside the bubble. The surrounding timeline row gets no padding or full-width outline. Keyboard focus can still outline the bubble itself.

## Verification

The production build and public SEO checks pass. Lint reports zero errors and the existing 415 warnings.

The local browser probe uses production assets, mock API responses and simulated safe-area values. It covers both themes at 320, 390, 414, 844 and 1280px, including ordinary browser insets and installed-app insets. Checks cover header/control bounds, home-indicator spacing, pointer and keyboard message focus, contract/conversation navigation, keyboard resize and viewport panning, plus landing, signup and legal pages.

No production accounts, messages or payments are used by the probe. Native iPhone Safari status-bar and keyboard behavior still need a device check after deployment; the simulation does not establish that the deployed version is live.
