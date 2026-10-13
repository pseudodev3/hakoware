# Mobile Home header

The mobile header now shows notifications and an account avatar. Tapping the avatar opens profile, Add Friend, appearance, and the full Aura balance in one sheet. The brand stays visible on narrow phones, and every action has at least a 44px touch target. The mobile sheet spans the screen width.

The production build and changed-component lint pass with zero lint errors. Chromium checked 320, 360, 375, 390, 430, 768, 1024, and 1280 pixels in both themes. Checks cover notification access, theme persistence, opening the invitation modal with correct focus, profile/balance navigation, Escape and focus return, friend-space controls, and dismissal when resizing to desktop. Additional response overrides cover long account names, a large Aura balance, a 99+ activity badge, an earned avatar frame, and 200% text. The existing card sheet was also checked for width, overflow, and focus return. Disposable local accounts were removed after validation.

- [Before at 375px](mobile-header-evidence/before-375-dark.png)
- [Updated header at 375px](mobile-header-evidence/after-375-dark.png)
- [Account actions](mobile-header-evidence/account-375-dark.png)
