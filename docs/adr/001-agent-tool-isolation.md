# ADR 001 — Agent tools call the service layer, never raw SQL

**Status:** Accepted

**Context:** The LangGraph agent needs read access to financial data. We could give it a direct database connection and let it generate queries, or we could wrap all data access in named service functions.

**Decision:** All agent tools (`get_transactions`, `get_budget_status`, `simulate_scenario`, `forecast_cashflow`) call the Python service layer. The LLM receives only the tool's return value — it never sees a database connection, ORM session, or SQL fragment.

**Consequences:** The service layer functions are the single source of truth for data access logic. Adding a new agent capability means writing a new tool + service function, not modifying the agent prompt. This also makes it safe to add a supervisor agent in Phase 2 without changing the data access contract.
