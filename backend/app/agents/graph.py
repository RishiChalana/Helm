"""
Phase 1: single LangGraph ReAct agent with multi-turn memory.
Phase 2 will refactor this into supervisor + sub-agents without changing the tool contracts.
"""
from typing import Annotated
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict
from app.agents.tools import AGENT_TOOLS
from app.core.config import get_settings

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.google_api_key,
).bind_tools(AGENT_TOOLS)

tool_node = ToolNode(AGENT_TOOLS)


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


async def run_agent(history: list[dict], user_message: str) -> str:
    """
    history: list of {"role": "user"|"assistant", "content": str}
    Returns the assistant's reply string.
    """
    messages: list[BaseMessage] = []
    for m in history:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        else:
            messages.append(AIMessage(content=m["content"]))
    messages.append(HumanMessage(content=user_message))

    result = await agent_graph.ainvoke({"messages": messages})
    last = result["messages"][-1]
    return last.content if isinstance(last.content, str) else str(last.content)
