from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.conversation import Conversation, Message, MessageRole
from app.models.audit_log import AuditLog
from app.schemas.agent import (
    AgentChatRequest, AgentChatResponse, ConversationOut,
    ReallocationProposalOut, GoalProposalOut,
)
from app.agents.graph import run_agent
from app.agents.tools import set_tool_context

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=AgentChatResponse)
async def chat(
    body: AgentChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Resolve or create conversation
    if body.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == body.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    else:
        conversation = Conversation(user_id=current_user.id)
        db.add(conversation)
        await db.flush()

    # Load history
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    history = [{"role": m.role.value, "content": m.content} for m in result.scalars().all()]

    # Inject DB context into tools; clear any stale pending actions
    set_tool_context(current_user.id, db)
    from app.agents.tools import _tool_context as _tc
    _tc.pop("pending_proposal", None)
    _tc.pop("pending_goal_proposal", None)

    try:
        reply = await run_agent(history, body.message)
    except Exception as exc:
        exc_str = str(exc)
        if "ResourceExhausted" in exc_str or "429" in exc_str or "quota" in exc_str.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI provider rate limit reached. Please try again in a minute.",
            )
        raise

    # Surface any pending structured actions to the client.
    # The LLM can only propose — execution requires an explicit POST from the app.
    pending_reallocation = _tc.pop("pending_proposal", None)
    proposal_out: ReallocationProposalOut | None = (
        ReallocationProposalOut(**pending_reallocation) if pending_reallocation else None
    )

    pending_goal = _tc.pop("pending_goal_proposal", None)
    goal_proposal_out: GoalProposalOut | None = (
        GoalProposalOut(**pending_goal) if pending_goal else None
    )

    # Persist both turns
    db.add(Message(conversation_id=conversation.id, role=MessageRole.user, content=body.message))
    db.add(Message(conversation_id=conversation.id, role=MessageRole.assistant, content=reply))
    db.add(AuditLog(user_id=current_user.id, action="agent_chat", actor="user"))
    await db.commit()

    return AgentChatResponse(
        reply=reply,
        conversation_id=conversation.id,
        proposal=proposal_out,
        goal_proposal=goal_proposal_out,
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().all()
    out = []
    for c in conversations:
        msgs_result = await db.execute(
            select(Message).where(Message.conversation_id == c.id).order_by(Message.created_at)
        )
        messages = [{"role": m.role.value, "content": m.content} for m in msgs_result.scalars().all()]
        out.append(ConversationOut(id=c.id, title=c.title, messages=messages))
    return out
