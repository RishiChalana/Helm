# ADR 004 — Multi-agent supervisor with heuristic-first routing

**Status:** Accepted

**Context:** Phase 1 used a single LangGraph ReAct agent with all tools (query + planning) bound to one LLM. As planning tools were added (`propose_reallocation`, `propose_savings_goal`, `simulate_scenario`), the model frequently called the wrong tool — e.g. calling `simulate_scenario` for a reallocation request instead of `propose_reallocation`. Mixing query and planning tool schemas also caused occasional hallucinated tool calls on query-only messages.

**Decision:** Split into three cooperating components:

1. **Query agent** — bound only to `QUERY_TOOLS`: `get_transactions`, `get_budget_status`, `get_spending_summary`, `forecast_cashflow`, `get_subscriptions`. Never sees planning tool schemas.

2. **Planning agent** — bound only to `PLANNING_TOOLS`: `simulate_scenario`, `propose_reallocation`, `propose_savings_goal`. Receives a `_PLANNING_TOOL_RULES` system prompt block that explicitly documents when to call each tool, because the three tools have overlapping surface areas.

3. **Supervisor** — classifies each message into one of three routes: `query`, `planning`, or `both`. Runs a **keyword heuristic first**; only calls the LLM supervisor when the heuristic returns `"query"` (i.e., no strong planning signal detected). For `both` routes, the query agent runs first and its output is injected as context into the planning agent's system prompt so it can reason about hypotheticals using real numbers without re-fetching data.

**Why heuristic-first:** Planning keywords (`"free up"`, `"save for"`, `"reallocate"`, `"what if"`, etc.) are unambiguous enough that a keyword match is more reliable and faster than an LLM call. The LLM supervisor adds value for nuanced query messages (e.g. "give me a summary of my finances this month" vs. "am I on track?") where heuristic returns `"query"` and the LLM can still upgrade to `"both"` if warranted.

**Consequences:** Tool selection accuracy for reallocation and goal-setting improved significantly. The planning agent no longer calls `simulate_scenario` for requests that should produce a confirmable proposal. The `both` route adds one extra LLM call (the query agent) per compound message — acceptable given compound messages are uncommon. The single-user `_tool_context` dict for passing proposals back to the API router remains unchanged.
