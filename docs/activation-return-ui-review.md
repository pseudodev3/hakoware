# Signup, activation and return flow

This pass balances three goals: help a new visitor understand Hakoware, get two people into their first contract, and give them a useful reason to return. It changes the landing, authentication, first-friend, invitation and Home guidance flows. Existing conversation, collection, Arena and After Hours features remain available.

## What changed

- The landing leads with the value of staying in touch. A labeled, interactive example lets visitors send a simulated check-in, see the other participant's reply and watch base Duo XP grow. It does not generate activity or claim real people are online.
- Primary calls to action open signup. The visible login action opens login, including on narrow screens. Choosing a landing-page mode carries that selection into the first-contract dialog during the same session.
- Signup explains the next step, supports password visibility, validates the existing eight-character password requirement, and includes privacy/terms links. Desktop uses an invitation and account layout; mobile keeps the form primary.
- Empty Home names the first action and shows the three-step journey. A sent invitation explains the wait and links to its status, with After Hours available to explore.
- First-season guidance stays until both participants have checked in. Season-start baselines do not count as check-ins, and XP earned by only one participant does not remove the guidance. The next action opens that specific friend space.
- Returning Home can offer an exact unread message, a completed-season recap, an open shared moment, or the next available check-in time. The timestamp reflects the existing twenty-hour cooldown; chatting remains available during the cooldown. Guidance does not change rewards, debt rules or send notifications.
- The invitation form supports Enter. Mode selection supports arrow keys, Home/End and a single tab stop, and freezes while a request is pending. The compact authentication back button now has an accessible name. New authentication and demo animation respect reduced motion.

## Verification

Production build and lint pass; lint still reports warnings under the repository's existing configuration. Three circle-activity tests and eight new activation/return tests pass. The new suite is included in CI.

Local Chromium checks cover 320, 390 and 1280-pixel public screens in both light and dark themes, including reduced motion, the interactive demo, signup/login destinations and password visibility. A real two-account local-Mongo workflow exercises mode selection, signup, invitation, acceptance, both first check-ins and the resulting return guidance. Conversation checks also cover narrow and desktop layouts in both themes. Checks verify no horizontal overflow and no browser page/console errors; disposable accounts are removed.

Evidence is retained in `/workspace/hakoware-dev/ui-evidence`. These checks use local services, not production accounts. This pass has not been deployed, and physical-device keyboard/microphone behavior has not been newly validated.

## Retention measurement

The intended loop is: invite a specific person, both make their first check-in, receive a useful reply, and return to that same relationship. Its success needs live cohort measurement after deployment:

| Measure | Definition | Why it matters |
| --- | --- | --- |
| Visitor conversion | New accounts / unique landing visitors | Tests whether the page communicates the value |
| First invitation | New accounts sending an invitation within 24 hours / new accounts | Finds friction between signup and a real relationship |
| Mutual activation | Accepted first contracts with a valid check-in from each participant within 72 hours / accepted first contracts | Measures the two-person outcome rather than a single click |
| Relationship return | Mutually activated participants returning to that friend space on a later day / mutually activated participants | Tests whether the shared relationship brings people back |
| D1 / D7 activity | Activated-account cohorts performing a meaningful action one / seven days after activation | Separates sustained usage from first-session curiosity |

The current founder metrics are not full visitor or D1/D7 cohorts. This pass does not introduce an analytics SDK or claim a measured retention lift. Compare cohorts before and after deployment before adding additional engagement mechanics.
