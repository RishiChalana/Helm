# Helm — Architecture

This document consolidates the four formal ADRs with the engineering decisions made throughout the build that weren't captured in individual ADRs.

---

## System Overview

Helm is an AI-powered personal finance copilot. A React Native / Expo mobile app talks to a FastAPI backend backed by Supabase (Postgres). All AI reasoning runs through a LangGraph multi-agent pipeline via Groq's API. Receipt scanning uses Google Gemini 2.5 Flash for vision.

```
Mobile (Expo / React Native)
        │  HTTPS REST + JWT
        ▼
FastAPI backend  ──────►  Supabase (Postgres via asyncpg)
        │
        ├── LangGraph agent ──► Groq (openai/gpt-oss-120b)
        │     ├── Supervisor
        │     ├── Query agent
        │     └── Planning agent
        │
        └── Receipt scanner ──► Google Gemini 2.5 Flash
```

### Infrastructure split: Supabase + Render

The backend is deployed on Render (free tier) with the database on Supabase. This split was deliberate: Render's own free-tier Postgres deletes the database after 30 days of inactivity, which caused data loss in a prior project (LeakGuard). Supabase's free tier retains data indefinitely. Render provides the compute; Supabase provides durable storage.

**Supabase connection note:** The direct connection hostname (`db.PROJECTREF.supabase.co`) is IPv6-only without a paid IPv4 add-on. The backend always connects via the Session mode pooler (`aws-REGION.pooler.supabase.com:5432`). The pooler uses a self-signed TLS chain, so `asyncpg` is configured with `check_hostname=False` / `CERT_NONE` — encrypted transport, no CA verification (equivalent to `sslmode=require`).

---

## ADR 001 — Agent tools call the service layer, never raw SQL

**Status:** Accepted

All agent tools (`get_transactions`, `get_budget_status`, `get_spending_summary`, `forecast_cashflow`, `get_subscriptions`) call the Python service layer. The LLM receives only the tool's return value — it never sees a database connection, ORM session, or SQL fragment.

The service layer functions are the single source of truth for data access logic. Adding a new agent capability means writing a new tool + service function, not modifying the agent prompt. This also made it safe to add a supervisor agent later without changing the data access contract.

---

## ADR 002 — Refresh token rotation with reuse detection

**Status:** Accepted

Each refresh token's SHA-256 hash is stored on the User row (`refresh_token_hash`). On refresh: decode the incoming token → hash it → compare to stored hash. Match: issue a new pair, update the hash. Mismatch: token was reused — invalidate by setting `refresh_token_hash = NULL`, return 401.

One hash per user means one active session. Multi-device support would require a token family table (deferred).

---

## ADR 003 — Materiality filter on proactive insights

**Status:** Accepted

The daily APScheduler job generates insights only when both conditions hold:
1. Actual budget pace deviates more than 15% above expected pace for the day-of-month.
2. Projected end-of-month spend exceeds the limit by more than 20%.

Either condition is waived if `is_over_budget` is already true. Insights that don't clear both thresholds are discarded — not stored, not pushed. Missing one alert (false negative) is preferred over notification fatigue.

Subscription detection runs separately in the same daily job: groups expense transactions by `(category, merchant)`, finds chains of ≥3 transactions with 23–38 day intervals and ≤10% amount variance, and fires a recurring-charge insight with a 60-day re-flag gate.

---

## ADR 004 — Multi-agent supervisor with heuristic-first routing

**Status:** Accepted

A single ReAct agent with all tools bound caused tool-selection confusion: the model called `simulate_scenario` for reallocation requests and hallucinated tool calls on pure query messages.

**Architecture:**

1. **Supervisor** — classifies each message into `query`, `planning`, or `both`. Runs a keyword heuristic first; calls the LLM only when the heuristic returns `query` (no unambiguous planning signal).

2. **Query agent** — bound only to `QUERY_TOOLS`. Never sees planning tool schemas.

3. **Planning agent** — bound only to `PLANNING_TOOLS` with an explicit `_PLANNING_TOOL_RULES` system prompt block distinguishing the three tools that have overlapping surface areas.

For `both` routes: query agent runs first, its output is injected into the planning agent's system prompt as context so it reasons about hypotheticals using real numbers without re-fetching.

---

## Propose/Execute Safety Pattern

The LLM can never directly mutate data. Budget reallocations and savings goals follow a two-step flow:

1. **LLM proposes** — the planning agent calls `propose_reallocation` or `propose_savings_goal`. These tools write an `AuditLog` row with `status="proposed"` and surface a structured `pending_proposal` payload in the chat response JSON.

2. **User confirms** — the mobile app renders a Confirm button from the structured payload. Tapping it calls a dedicated REST endpoint (`POST /api/v1/reallocations/{id}/confirm` or `POST /api/v1/goals`), which performs the actual write and updates the audit log to `status="confirmed"`.

The LLM's tool functions are read-only from the database's perspective. No amount of prompt injection can cause an unconfirmed write.

---

## LLM Provider History

Three provider migrations happened during this build:

| Phase | Provider | Model | Reason for change |
|---|---|---|---|
| Phase 1 | Anthropic (Claude) | claude-3-5-haiku | Initial build; Anthropic tool-use API |
| Phase 2 | Google Gemini | gemini-2.0-flash | Cost; Gemini free tier; LangChain integration |
| Phase 3 | Groq | openai/gpt-oss-120b | Gemini quota exhaustion on the Gemini free tier blocked development; Groq's free tier has higher throughput and the model handles tool-calling reliably |

**Gemini is retained** for receipt scanning only (`receipt_service.py`), where `gemini-2.5-flash`'s vision capability is used to parse grocery/restaurant receipts into structured line items. The main agent (supervisor, query agent, planning agent, PDF statement extractor) all run on Groq.

---

## SMS Auto-capture: Deliberately Scoped Out

Bank transaction SMS parsing was evaluated as a potential input channel (many Indian banks send SMS alerts for every transaction). It was scoped out for three reasons:

1. `READ_SMS` is a sensitive Android permission that triggers Play Store review scrutiny and user hesitation at install time.
2. The marginal value over PDF statement import and receipt scanning is low — both of those capture the same data without the permission cost.
3. SMS content from banks often includes account numbers and OTPs, making the privacy surface larger than the feature justifies.

The feature left no residue in the codebase.

---

## Mobile: Environment Variable Baking

`EXPO_PUBLIC_API_URL` is read in `lib/api.ts` as `process.env.EXPO_PUBLIC_API_URL`. Metro inlines all `EXPO_PUBLIC_*` variables at **JS bundle time**, not native build time. Changing the backend URL requires a Metro rebuild (`expo run:android` or clearing Metro cache) — a `gradle` rebuild alone is not sufficient.

For wireless development without USB, run `expo start --tunnel` which creates an ngrok tunnel. The tunnel URL changes each session and must be updated in the dev menu.
