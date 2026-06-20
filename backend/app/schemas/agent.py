from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


class AgentChatResponse(BaseModel):
    reply: str
    conversation_id: int


class ConversationOut(BaseModel):
    id: int
    title: str | None
    messages: list[ChatMessage]

    model_config = {"from_attributes": True}
