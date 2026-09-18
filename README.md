# Hakoware

<p align="center">
  <img src="./public/hakoware-mark-v2.png" alt="Hakoware" width="88" />
</p>

<p align="center">
  <strong>Keep the loop alive.</strong><br />
  A social game about real relationships, recurring contracts, Duo XP, debt, Chaos and the consequences of disappearing.
</p>

<p align="center">
  <a href="https://hakoware.vercel.app">Open Hakoware</a>
</p>

## What Hakoware is

Hakoware turns staying in touch into a game.

Two people start a contract, choose the rules, and play through a season together. Check-ins build Duo XP. Silence builds debt. Enough debt can trigger bankruptcy, which unlocks Arena mechanics such as bounties and Claims. Chaos Contracts can temporarily rewrite the rules.

The goal is not to replace real relationships with metrics. Hakoware gives existing relationships a playful shared system with visible history, stakes and moments worth remembering.

## Core loop

1. Find someone by **@username** or invite them by email.
2. Start a contract.
3. Check in before the grace period expires.
4. Earn Duo XP and build a persistent Duo level.
5. Survive debt, bankruptcy, bounties, Chaos and weekly Season Events.
6. Finish the season and get a recap.
7. Run it back.

## Contract modes

Current modes include:

- **Don't Ghost Me** - the classic three-day grace period.
- **Gym Pact** - tighter pressure for training partners.
- **Study Arc** - daily-ish accountability for study partners.
- **30-Day Lock-In** - one-day grace period for a fixed month.
- **Long Distance** - a longer window with bonus voice XP.
- **Build in Public** - daily check-ins for people shipping together.
- **Chaos Contract** - anomalies can temporarily change the rules.
- **Custom** - choose your own grace period.

Most seasons run for 30 days. Long Distance runs for 45.

## Game systems

### Duo progression

Duo XP persists across seasons.

Current progression:

```text
level = floor(sqrt(xp / 50)) + 1
```

Titles progress from **New Contract** through ranks such as **Locked In**, **Partners in Crime**, **Certified Menaces**, **Unbreakable Contract**, and eventually **Legendary Duo**.

### Check-ins

Hakoware supports text and voice check-ins.

- text check-in: base 10 Duo XP
- voice check-in: base 15 Duo XP
- one valid check-in every 20 hours per side of a contract
- Long Distance, Chaos and Season Events can modify rewards

Voice notes are stored privately and only become available to the intended contract recipient after the check-in commits successfully.

### Debt and bankruptcy

Missing the grace period creates debt.

Bankruptcy currently follows:

```text
BANKRUPT -> RECOVERING -> STABLE
```

A bankrupt player needs two valid recovery check-ins rather than instantly clearing everything with one tap.

Bankruptcy is also the gate for several Arena mechanics.

### Arena

The Arena is where social pressure becomes a game system.

Current mechanics include:

- bankruptcy-only bounties
- hunter bonds and proof
- Claims
- public Grudges
- revenge windows
- Shame Board visibility controls
- Wanted states from failed Chaos events

Aura is an in-game virtual resource. It is not cryptocurrency and has no cash value.

### Chaos

Chaos Contracts can trigger temporary anomalies such as:

- Voice Tax
- Double Trouble
- Aura Surge
- Wildcard
- Silence Is Expensive
- Sudden Death

Chaos runs in the background so events can progress even when nobody has the app open.

### Season Events

A deterministic weekly modifier affects the whole game. Examples include:

- **Duo Rush** - boosted Duo XP
- **Open Mic** - bonus voice XP
- **Clean Sweep** - extra XP on successful check-ins
- **Anomaly Season** - faster Chaos cycles

Season Events are surfaced consistently across the signed-in app with their active effect and remaining time.

## Identity and authentication

Hakoware is **username-first socially, email-backed operationally**.

New accounts use:

```text
username
email
password
```

Users can sign in with either their username, `@username`, or email plus password.

Public/social identity uses `@username`. Email remains private and is used for recovery, invitations and important account messages.

Legacy accounts created before usernames are prompted once to claim a username.

Reserved system, route and Hakoware brand usernames are enforced server-side.

## App structure

The signed-in product has four main surfaces:

- **Home** - immediate contract state, active Season Event and important pressure.
- **Contracts** - roster, pending challenges, seasons and contract actions.
- **Arena** - bounties, hunts, Grudges and the Shame Board.
- **You** - profile, Aura, inventory, Duo sharing and account controls.

Founder tooling lives separately at `/founder` and is not linked from normal navigation.

## Founder Lab

The Founder Lab provides isolated test accounts and real game-state simulation without contaminating production social data.

It can:

- create disposable test players
- create test contracts
- force Clear, Ready, Overdue and Bankrupt states
- force specific Chaos anomalies
- adjust test Aura
- end seasons
- impersonate a test player
- clean up test data

Test users, bounties, Grudges and Shame Board state remain isolated from real users.

## Stack

### Frontend

- React 18
- Vite 5
- React Router
- Framer Motion
- Lucide React
- Vercel

### Backend

- Node.js
- Express 5
- MongoDB + Mongoose
- JWT authentication
- bcrypt
- Railway

### Services

- Brevo for transactional email
- Railway object storage for private voice notes
- GitHub Actions for validation and security gates

## Local development

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

Copy the required environment variables from `server/.env.example` into your local environment. Never commit real credentials or secrets.

The frontend expects its API base URL through the configured Vite environment.

## Validation

The repository CI checks:

- frontend production dependency audit
- backend production dependency audit
- tracked environment files
- obvious committed secret patterns
- frontend production build
- backend syntax

Run a production frontend build locally with:

```bash
npm run build
```

## Product principles

Hakoware should feel like a game first, not a generic dashboard.

- calm, restrained base interface
- louder treatment only when the game state deserves it
- mobile-first interaction quality
- dark and light mode support
- purposeful motion
- no generic card soup
- no fake activity or fake stats
- social pressure stays playful, never coercive

## Trust and safety

Hakoware includes social mechanics that can be dramatic by design, but they are not permission for harassment, threats, stalking, privacy abuse or real-world punishment.

The app includes:

- Privacy Policy
- Terms of Use
- Community Guidelines
- support and safety contact routes
- visibility controls for public bankruptcy surfaces

See the in-app legal pages for the current user-facing policies.

## Deployment

- Frontend: [hakoware.vercel.app](https://hakoware.vercel.app)
- Backend: Railway
- Database: MongoDB

A merged commit is not automatically considered live. Deployment status should be checked separately before announcing a feature as deployed.

## Project continuity

For detailed implementation notes, gameplay rules, Founder Lab internals and operational caveats, see [HANDOFF.md](./HANDOFF.md).
