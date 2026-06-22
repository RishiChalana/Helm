"""
Phase 2: supervisor + sub-agent architecture.

Supervisor classifies the user's intent into one of three routes:
  "query"    → Query agent  (get_transactions, get_budget_status,
                              get_spending_summary, forecast_cashflow)
  "planning" → Planning agent (simulate_scenario)
  "both"     → Query agent runs first; its output is injected as context
               into the Planning agent so it can reason about hypotheticals
               using real numbers.

Tool contracts in tools.py are unchanged.
"""
import logging
from datetime import date
from typing import Annotated, Literal

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph, add_messages
from typing_extensions import TypedDict

from app.agents.tools import PLANNING_TOOLS, QUERY_TOOLS
from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


# ── Supervisor ─────────────────────────────────────────────────────────────────

_SUPERVISOR_SYSTEM = """\
You are a routing supervisor for Helm, an AI finance assistant.
Classify the user's intent into exactly one of these three labels:

query    – needs current financial data only (transactions, budget status, spending
           totals, cashflow projections, subscription detection). No action needed.

planning – requires an action or hypothetical modelling. Route here when the user
           wants to:
           • REALLOCATE budget between categories ("free up", "cut X to fund Y",
             "move money from X to Y", "reallocate", "I want more budget for X",
             "can I free up", "free up budget for")
           • SET A SAVINGS GOAL ("save for", "set a goal", "I want to buy X",
             "savings plan", "help me save", "savings goal")
           • RUN A WHAT-IF with all parameters already supplied
             (e.g. "if I save ₹5,000/month, how long to reach ₹100,000?",
              "what if I cut dining by 20%?")

both     – compound: needs CURRENT data first, THEN an action/hypothetical.
           Signal: same message asks "what is my X?" AND "what would happen if Y?"
           (e.g. "what is my budget pace AND what if I cut dining by 20%?").

Examples:
"Can I free up budget for dining by cutting entertainment?" → planning
"Help me reallocate budget from transport to food" → planning
"Set a savings goal to save ₹50,000 for a vacation" → planning
"What would happen if I cut dining by 20%?" → planning
"If I save ₹5,000 a month how long to reach ₹100,000?" → planning
"What is my budget status?" → query
"Show me my transactions this month" → query
"How much did I spend on food?" → query
"What is my budget pace AND what would happen if I cut dining by 20%?" → both

Reply with a single word: query, planning, or both. No punctuation, no explanation.
"""

# Plain LLM — no tool-calling, no structured output.
# Keeping it separate from the tool-bound agents avoids any schema cross-contamination.
_supervisor_llm = ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=settings.groq_api_key,
    temperature=0,
    max_tokens=10,
)


async def _classify_intent(user_message: str) -> Literal["query", "planning", "both"]:
    """Classify intent: heuristic takes precedence for explicit planning signals."""
    # Heuristic runs first — it only fires on unambiguous planning keywords
    # (reallocation, savings goal, what-if).  When it produces a non-query result,
    # trust it rather than letting the LLM supervisor override it.
    heuristic = _heuristic_route(user_message)
    if heuristic != "query":
        log.info("[supervisor] heuristic route=%s  message=%r", heuristic, user_message[:80])
        return heuristic

    # No strong planning signal — ask the LLM for nuanced classification.
    try:
        response = await _supervisor_llm.ainvoke([
            SystemMessage(content=_SUPERVISOR_SYSTEM),
            HumanMessage(content=user_message),
        ])
        text = response.content.strip().lower()
        if "both" in text:
            route: Literal["query", "planning", "both"] = "both"
        elif "planning" in text:
            route = "planning"
        else:
            route = "query"
    except Exception as exc:
        log.warning("Supervisor LLM failed (%s); using heuristic fallback.", exc)
        route = heuristic
    log.info("[supervisor] llm route=%s  message=%r", route, user_message[:80])
    return route


def _heuristic_route(msg: str) -> Literal["query", "planning", "both"]:
    """Keyword fallback if the supervisor LLM call fails."""
    m = msg.lower()
    planning_signals = {
        "what if", "what would happen", "if i cut", "simulate", "scenario",
        "reallocate", "reallocation", "free up", "cut dining", "cut entertainment",
        "move money", "fund dining", "fund ", "set a goal", "save for", "savings goal",
        "i want to buy", "can i free",
    }
    query_signals = {"budget", "pace", "spending", "transactions", "balance", "cashflow", "how much"}
    has_planning = any(s in m for s in planning_signals)
    has_query = any(s in m for s in query_signals)
    if has_planning and has_query:
        return "both"
    return "planning" if has_planning else "query"


# ── ReAct graph factory ────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def _build_react_graph(llm, tools: list):
    """Build a minimal ReAct (reason-act) LangGraph for the given LLM + tools."""
    tools_by_name = {t.name: t for t in tools}

    async def call_model(state: AgentState) -> AgentState:
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    async def tool_node(state: AgentState) -> AgentState:
        last = state["messages"][-1]
        results: list[BaseMessage] = []
        for call in last.tool_calls:
            log.info("[tool_call] %s  args=%s", call["name"], call["args"])
            tool = tools_by_name.get(call["name"])
            if tool is None:
                content = f"Unknown tool: {call['name']}"
            else:
                try:
                    content = str(await tool.ainvoke(call["args"]))
                except Exception as exc:
                    content = f"Tool error: {exc}"
            log.info("[tool_result] %s  -> %s", call["name"], str(content)[:120])
            results.append(ToolMessage(content=content, tool_call_id=call["id"]))
        return {"messages": results}

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    g = StateGraph(AgentState)
    g.add_node("agent", call_model)
    g.add_node("tools", tool_node)
    g.set_entry_point("agent")
    g.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    g.add_edge("tools", "agent")
    return g.compile()


_query_llm = ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=settings.groq_api_key,
).bind_tools(QUERY_TOOLS, parallel_tool_calls=False)

_planning_llm = ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=settings.groq_api_key,
).bind_tools(PLANNING_TOOLS, parallel_tool_calls=False)

_query_graph = _build_react_graph(_query_llm, QUERY_TOOLS)
_planning_graph = _build_react_graph(_planning_llm, PLANNING_TOOLS)


# ── Shared helpers ─────────────────────────────────────────────────────────────

_PLANNING_TOOL_RULES = """\
PLANNING TOOL SELECTION — read this before choosing a tool:

1. propose_reallocation — use when the user wants to MOVE budget money from one \
category to free up room in another. Keywords: "free up budget", "cut X to fund Y", \
"move money from X to Y", "reallocate", "reduce X so I can spend more on Y".
   Example: "Can I free up budget for dining by cutting entertainment?" \
→ call propose_reallocation (NOT simulate_scenario).

2. propose_savings_goal — use when the user wants to SET A SAVINGS GOAL or save \
toward a target. Keywords: "save for", "set a goal", "savings plan", "I want to buy", \
"how can I save up for".
   Example: "Help me set a goal to save ₹50,000 for a trip" \
→ call propose_savings_goal (NOT simulate_scenario).

3. simulate_scenario — use ONLY for read-only hypothetical analysis where the user \
wants to SEE the effect of a change without committing to it. Keywords: "what would \
happen if", "what if I cut", "how much would I save if", "project", "forecast".
   Example: "What would happen if I cut dining by 20%?" \
→ call simulate_scenario.

CRITICAL: simulate_scenario is read-only; it cannot create proposals the user can \
confirm. If the user wants to actually reallocate or set a goal, you MUST call \
propose_reallocation or propose_savings_goal instead.
"""


def _system_prompt(extra: str = "", planning: bool = False) -> SystemMessage:
    today = date.today().isoformat()
    content = (
        f"Today's date is {today}. "
        "You are Helm, an AI finance copilot. "
        "All monetary amounts are in Indian Rupees. Always format money as ₹X,XXX — never use $. "
        "When the user mentions a relative time period ('this month', 'last week', 'this year', etc.) "
        "compute the exact ISO start_date and end_date yourself from today's date before calling any "
        "tool — never ask the user to supply dates they didn't explicitly provide. "
        "For questions about total spending or spending by category, prefer get_spending_summary over "
        "get_transactions. get_transactions is for fetching individual line-item records; "
        "get_spending_summary is for totals and breakdowns."
    )
    if planning:
        content += f"\n\n{_PLANNING_TOOL_RULES}"
    if extra:
        content += f"\n\n{extra}"
    return SystemMessage(content=content)


def _build_messages(
    history: list[dict],
    user_message: str,
    extra_system: str = "",
    planning: bool = False,
) -> list[BaseMessage]:
    msgs: list[BaseMessage] = [_system_prompt(extra_system, planning=planning)]
    for m in history:
        if m["role"] == "user":
            msgs.append(HumanMessage(content=m["content"]))
        else:
            msgs.append(AIMessage(content=m["content"]))
    msgs.append(HumanMessage(content=user_message))
    return msgs


async def _invoke(graph, messages: list[BaseMessage], max_retries: int = 2) -> str:
    """Invoke a sub-agent graph; retry up to max_retries on Groq 400/tool-call errors."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            # recursion_limit caps runaway loops: 16 node activations ≈ 7 tool-call rounds.
            result = await graph.ainvoke(
                {"messages": messages},
                config={"recursion_limit": 16},
            )
            last = result["messages"][-1]
            return last.content if isinstance(last.content, str) else str(last.content)
        except Exception as exc:
            err = str(exc)
            # Only retry Groq 400/tool_use_failed — the model occasionally emits
            # malformed XML function syntax that the API rejects; a fresh attempt
            # usually produces valid JSON.  Do NOT retry 429 (rate/quota) or 5xx.
            if ("tool_use_failed" in err or "BadRequest" in err) and "400" in err:
                log.warning(
                    "Sub-agent tool-call error (attempt %d/%d): %s",
                    attempt + 1, max_retries + 1, err[:120],
                )
                last_exc = exc
            else:
                raise
    raise last_exc  # type: ignore[misc]


# ── Public entrypoint (same interface as Phase 1) ──────────────────────────────

async def run_agent(history: list[dict], user_message: str) -> str:
    """
    Supervisor-routed entrypoint.
    history: list of {"role": "user"|"assistant", "content": str}
    Returns the assistant's reply string.
    """
    route = await _classify_intent(user_message)

    if route == "query":
        log.info("[chain] query_agent")
        return await _invoke(_query_graph, _build_messages(history, user_message))

    if route == "planning":
        log.info("[chain] planning_agent")
        return await _invoke(_planning_graph, _build_messages(history, user_message, planning=True))

    # route == "both": query agent → planning agent
    log.info("[chain] query_agent → planning_agent")

    query_reply = await _invoke(_query_graph, _build_messages(history, user_message))
    log.info("[chain] query_agent replied: %r", query_reply[:120])

    planning_extra = (
        "The query agent has already retrieved the user's current financial data:\n"
        f"{query_reply}\n\n"
        "Use that data to answer the hypothetical part of the user's question. "
        "You do not need to re-fetch any data."
    )
    planning_messages = _build_messages(history, user_message, extra_system=planning_extra, planning=True)
    reply = await _invoke(_planning_graph, planning_messages)
    log.info("[chain] planning_agent replied: %r", reply[:120])
    return reply
