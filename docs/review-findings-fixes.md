# Review findings fixed

Uncertain Aura bank requests retain their original action, amount, and retry key per account in this browser tab. Closing the dialog, leaving the bank, switching accounts, or reloading does not replace that intent. A visible confirmation action remains available even when the original repayment cleared the wallet or loan. Amount choices stay locked until confirmation; a successful response or a definite validation/conflict rejection clears the pending intent. When browser storage is denied or full, an in-memory fallback preserves retries across component remounts.

Actual Duo XP now preserves both participants’ earned credit after check-ins and season restart bonuses. Ending a Duo also preserves its credit before deleting the XP, including for existing Duos that have never visited the bank. Credit updates use a monotonic maximum. A temporary credit-save failure does not reject an already committed check-in; the durable XP remains recoverable, and deletion waits for credit preservation. Borrowing still requires mutual check-ins and the existing wallet, debt, and cooldown gates.

Shared modals use the visible viewport bounds at every width. Short landscape layouts use smaller header and footer spacing so the note and action buttons remain usable with the keyboard open. The bank’s duplicate viewport listener and CSS override are removed.

Rejected trade preparation no longer appends a refund receipt to an untouched recipient. Sender cancellation fences, recipient fences for published offers, and refunds of existing legacy receipts remain intact. A preparation rejection can only close a trade still in preparation, so it cannot override a concurrently published offer.

Validation passed:

- Production build, all 17 frontend checks, and backend syntax checks. ESLint reports zero errors and 393 existing warnings.
- Aura bank, earned Duo credit, standalone card exchange, friend spaces, card/wall compatibility, and client payload suites. New credit and trade cases exercise standalone MongoDB with secondary index builds blocked.
- Chromium tests confirm repayment intent across close/reopen, different presets, remount, account switching, reload, full repayment, failure before commit, definite rejection, and uncertain borrowing. Confirmed actions permit a fresh request; uncertain actions retain the original key.
- Chromium check-in tests at 320, 844, 768, and 1280 pixels verify visible action buttons, a scrollable note field, and focus/listener cleanup. Keyboard heights were simulated at 340, 210, and 300 pixels; physical-device keyboard behavior has not been verified.

CI includes the new bank retry and earned-credit checks plus the extended standalone trade regression cases. Tests used disposable databases and mocked browser failure responses; no production data was changed.
