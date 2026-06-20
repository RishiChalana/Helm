# AI Finance Copilot — Build Spec

> **For Claude Code:** Read this fully before writing any code. Follow phases in strict order — do not start Phase N+1 until Phase N works end-to-end (backend + UI + tested on device/emulator). If a phase can't be finished in the time available, stop there; a fully-working earlier phase beats a partially-built later one.

## Vision

A mobile-first personal finance app where an LLM agent is the primary interface, not a bolted-on chat feature. Users log spending conversationally, get proactive insights pushed to them without asking, and can simulate financial scenarios in real time.

**Positioning note (important for interviews/resume framing):** This space is competitive — Origin's AI Advisor already runs multi-agent orchestration for spend/invest/planning, Rocket Money already auto-negotiates and cancels subscriptions, and SMS-based expense parsing (axio/Walnut, Money View) has existed in India since 2014. Don't pitch this as novel. Pitch it as: *"I researched how Origin, Rocket Money, and SMS-based apps like axio approach this, and built my own implementation with deliberate architecture choices."* That's the defensible, credible story.

## Tech Stack

**Mobile:** React Native + Expo, TypeScript, NativeWind, React Navigation, `expo-notifications` (push), `expo-local-authentication` (biometric), Android widget via native module or Expo config plugin.

**Backend:** FastAPI, PostgreSQL + SQLAlchemy + Alembic (migrations), LangGraph for agent orchestration, Redis (cache + session), APScheduler (scheduled insight jobs).

**Auth:** JWT + refresh tokens (server-side), biometric gate client-side before reading local token.

**Deploy:** Backend → Render/Railway. Mobile → Expo Go for demos/interviews (no app-store publishing required).

## Architecture

```
Mobile (RN/Expo) ──HTTPS──> FastAPI ──> PostgreSQL
                               │
                               ├──> Redis (cache, session)
                               ├──> LangGraph agent service (tool-calls into service layer, never raw SQL from the LLM)
                               └──> APScheduler job ──> Expo Push API ──> Mobile
```

## Folder Structure

```
backend/
  app/
    agents/          # LangGraph graphs, tool definitions, supervisor (Phase 2)
    api/             # routers: auth, transactions, budgets, insights, agent
    models/          # SQLAlchemy models
    services/        # business logic, called by both API routes and agent tools
    jobs/             # scheduled insight generation
    core/            # config, security, JWT
  alembic/
mobile/
  app/               # screens, navigation
  components/
  hooks/
  lib/               # api client, push notification setup, biometric wrapper
docs/
  adr/               # architecture decision records for key trade-offs
```

## Phase 1 — Foundation (resume-grade on its own)

- **Auth:** JWT + refresh token rotation, register/login, biometric gate on app open
- **Core CRUD:** transactions, budgets — SQLAlchemy models + Pydantic schemas, real validation
- **Agent tools (single agent, no orchestration yet):**
  - `get_transactions(filters: DateRange, category?, merchant?)`
  - `get_budget_status(budget_id?)` → current spend, limit, pace projection
  - `simulate_scenario(params)` → e.g. "save ₹X more/month" → recalculated savings timeline
  - `forecast_cashflow(horizon_days)` → simple projection from historical spend/income
  - All tools call the service layer directly — the LLM never writes raw SQL
- **Multi-turn memory:** persist conversation thread per user; pass history into LangGraph state
- **Proactive insight engine:** daily APScheduler job runs the agent in "insight mode," generates 0–3 candidate insights, filters for materiality (e.g., >15% budget pace deviation) before pushing — avoids notification fatigue from trivial alerts
- **Scenario simulator UI:** slider-driven, instant recalculation
- **Visual design:** dark-first palette, signature flowing cash-flow visualization, animated radial budget gauges (not stock charts)
- **Biometric unlock + home-screen widget** (balance + budget pace)

## Phase 2 — Tier 1: Agent capability expansion
*One at a time. Each fully working — backend + UI + tested — before starting the next.*

1. **Multi-agent orchestration** — refactor the Phase 1 single agent into a supervisor + `categorization-agent` + `budget-watchdog-agent` + `insight-writer-agent` (LangGraph subgraphs). This is a refactor of working code, not a rebuild.
2. **Closed-loop budget rebalancing** — `propose_reallocation` tool → explicit user confirmation screen → `execute_reallocation` tool (only callable post-confirmation) → logged undo entry.
3. **Subscription audit agent** — detect recurring transactions, flag any unreviewed for 60+ days, draft a cancel-reminder (no usage-signal data available, so this is a review-prompt heuristic, not true usage detection — document that limitation).
4. **Goal-setting agent** — analyze income/expense delta, propose a realistic savings goal with stated reasoning, create on confirm.

## Phase 3 — Tier 2: Multimodal / mobile-native flex

1. **Receipt scanning** — photo → vision-capable model → structured line items → auto-categorized transaction draft, user confirms before it's saved.
2. **SMS-based auto-capture** — **Android only.** Document the iOS limitation explicitly (iOS restricts third-party SMS access) — this must be a stated platform limitation, not a silent gap. Use regex + LLM fallback for parsing common Indian bank/UPI SMS formats.

## Hard Rules (carried over from the FinTrack postmortem — do not violate)

1. Never leave a schema-only or stub feature in the app pretending to be functional. Cut it or finish it.
2. Closed-loop agent actions always require explicit user confirmation before executing — no silent autonomous changes to money.
3. No fabricated/hardcoded data anywhere in the UI (e.g., no placeholder "+20% from last month" style stats).
4. One clean auth flow, one route per screen — no duplicate/dead routes.

## Security Notes

- Encrypt any sensitive text extracted from SMS at rest
- Rate-limit auth endpoints
- Audit log every agent-initiated action (rebalancing, goal creation, subscription flags)
