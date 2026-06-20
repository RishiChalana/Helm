"""
Phase 1: single LangGraph ReAct agent with multi-turn memory.
Phase 2 will refactor this into supervisor + sub-agents without changing the tool contracts.
"""
from datetime import date
from typing import Annotated
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, END, add_messages
from typing_extensions import TypedDict
from app.agents.tools import AGENT_TOOLS
from app.core.config import get_settings

settings = get_settings()

# parallel_tool_calls=False prevents llama-3.3-70b from falling back to its
# native XML function-call format, which Groq's API validation rejects.
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
).bind_tools(AGENT_TOOLS, parallel_tool_calls=False)

# Map tool name → callable for the manual executor below
_tools_by_name = {t.name: t for t in AGENT_TOOLS}


async def tool_node(state: "AgentState") -> "AgentState":
    """Execute all tool calls in the last AI message and return ToolMessages."""
    last = state["messages"][-1]
    results: list[BaseMessage] = []
    for call in last.tool_calls:
        tool = _tools_by_name.get(call["name"])
        if tool is None:
            content = f"Unknown tool: {call['name']}"
        else:
            try:
                content = str(await tool.ainvoke(call["args"]))
            except Exception as exc:
                content = f"Tool error: {exc}"
        results.append(ToolMessage(content=content, tool_call_id=call["id"]))
    return {"messages": results}


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


async def call_model(state: AgentState) -> AgentState:
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


agent_graph = build_graph()


def _system_prompt() -> str:
    today = date.today().isoformat()
    return (
        f"Today's date is {today}. "
        "You are Helm, an AI finance copilot. "
        "All monetary amounts are in Indian Rupees. Always format money as ₹X,XXX — never use $. "
        "When the user mentions a relative time period ('this month', 'last week', 'this year', etc.) "
        "compute the exact ISO start_date and end_date yourself from today's date before calling any tool — "
        "never ask the user to supply dates they didn't explicitly provide. "
        "For questions about total spending or spending by category, prefer get_spending_summary over get_transactions. "
        "get_transactions is for fetching individual line-item records; get_spending_summary is for totals and breakdowns."
    )


async def run_agent(history: list[dict], user_message: str) -> str:
    """
    history: list of {"role": "user"|"assistant", "content": str}
    Returns the assistant's reply string.
    """
    messages: list[BaseMessage] = [SystemMessage(content=_system_prompt())]
    for m in history:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        else:
            messages.append(AIMessage(content=m["content"]))
    messages.append(HumanMessage(content=user_message))

    result = await agent_graph.ainvoke({"messages": messages})
    last = result["messages"][-1]
    return last.content if isinstance(last.content, str) else str(last.content)
