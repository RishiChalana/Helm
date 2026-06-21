from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


class ReallocationProposalOut(BaseModel):
    proposal_id: str
    audit_log_id: int
    from_category: str
    to_category: str
    amount: float
    from_old_limit: float
    from_new_limit: float
    to_old_limit: float | None
    to_new_limit: float | None
    description: str


class AgentChatResponse(BaseModel):
    reply: str
    conversation_id: int
    proposal: ReallocationProposalOut | None = None


class ConversationOut(BaseModel):
    id: int
    title: str | None
    messages: list[ChatMessage]

    model_config = {"from_attributes": True}
