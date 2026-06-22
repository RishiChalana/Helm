# AI Finance Copilot — Build Spec

> **For Claude Code:** Read this fully before writing any code. Follow phases in strict order — do not start Phase N+1 until Phase N works end-to-end (backend + UI + tested on device/emulator). If a phase can't be finished in the time available, stop there; a fully-working earlier phase beats a partially-built later one.

## Vision

A mobile-first personal finance app where an LLM agent is the primary interface, not a bolted-on chat feature. Users log spending conversationally, get proactive insights pushed to them without asking, and can simulate financial scenarios in real time.

**Positioning note (important for interviews/resume framing):** This space is competitive — Origin's AI Advisor already runs multi-agent orchestration for spend/invest/planning, Rocket Money already auto-negotiates and cancels subscriptions, and SMS-based expense parsing (axio/Walnut, Money View) has existed in India since 2014. Don't pitch this as novel. Pitch it as: *"I researched how Origin, Rocket Money, and SMS-based apps like axio approach this, and built my own implementation with deliberate architecture choices."* That's the defensible, credible story.

## Tech Stack

**Mobile:** React Native + Expo SDK 51, TypeScript, NativeWind 4.x, expo-router, `expo-notifications` (push), `expo-local-authentication` (biometric), `@shopify/react-native-skia` (charts). Native dev client required (Expo Go incompatible).

**Backend:** FastAPI, PostgreSQL + SQLAlchemy 2.0 async + Alembic, LangGraph for agent orchestration, Redis (rate-limit + session), APScheduler (scheduled insight/subscription jobs).

**Agent LLM:** Groq API — model `openai/gpt-oss-120b` for conversation, supervisor routing, and PDF extraction. Google Gemini 2.5 Flash (`google-genai` SDK) for receipt OCR.

**Auth:** JWT access tokens + refresh token rotation with server-side reuse detection; biometric gate client-side before reading local token.

**Deploy:** Backend → Render/Railway. Mobile → native dev client build on Android emulator.

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

## Phase 1 — Foundation ✅ COMPLETE

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
- **Visual design:** forest-dark palette (`#0e1511`), Skia cash-flow chart, flat budget pace bars
- **Biometric unlock** (expo-local-authentication)

## Phase 2 — Tier 1: Agent capability expansion ✅ COMPLETE

1. **Multi-agent supervisor routing** ✅ — heuristic-first classifier (keyword match) with LLM fallback; three routes: `query` / `planning` / `both`. Query agent and planning agent have separate tool schemas — no cross-contamination. See ADR 004.
2. **Closed-loop budget rebalancing** ✅ — `propose_reallocation` tool → ProposalCard (CONFIRM / DISMISS) inline in chat → `execute_reallocation` (only post-confirmation) → 30s undo window → audit log entry.
3. **Goal-setting agent** ✅ — `propose_savings_goal` tool → GoalProposalCard (SET GOAL / DISMISS) → creates goal on confirm with monthly amount + timeline.
4. **Subscription / recurring pattern detection** ✅ — `recurring_pattern` model + `subscription_service`; `get_subscriptions` query tool; daily insight job generates subscription insights.

## Phase 3 — Tier 2: Multimodal / mobile-native flex ✅ COMPLETE (receipt + PDF)

1. **Receipt scanning** ✅ — photo → Gemini 2.5 Flash → structured line items → review screen → bulk import. Model: `gemini-2.5-flash` via `google-genai` SDK. 25-second client-side timeout with user-friendly error message ("Couldn't read this as a receipt").
2. **Bank statement PDF import** ✅ — PDF upload → `openai/gpt-oss-120b` (via Groq) extracts transactions → review screen with per-row edit/include controls + duplicate detection → bulk import.
3. **SMS-based auto-capture** — **Not implemented.** iOS restricts third-party SMS access entirely; Android support deprioritized. Platform limitation, not a silent gap.

## Hard Rules (carried over from the FinTrack postmortem — do not violate)

1. Never leave a schema-only or stub feature in the app pretending to be functional. Cut it or finish it.
2. Closed-loop agent actions always require explicit user confirmation before executing — no silent autonomous changes to money.
3. No fabricated/hardcoded data anywhere in the UI (e.g., no placeholder "+20% from last month" style stats).
4. One clean auth flow, one route per screen — no duplicate/dead routes.

## Security Notes

- Encrypt any sensitive text extracted from SMS at rest
- Rate-limit auth endpoints
- Audit log every agent-initiated action (rebalancing, goal creation, subscription flags)
