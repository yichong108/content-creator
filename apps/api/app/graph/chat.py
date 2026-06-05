from typing import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from app.config import settings


class ChatState(TypedDict):
    messages: list[BaseMessage]


def _build_model() -> ChatOpenAI:
    kwargs: dict = {
        "model": settings.openai_model,
        "api_key": settings.openai_api_key or None,
    }
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    return ChatOpenAI(**kwargs)


def chatbot_node(state: ChatState) -> ChatState:
    model = _build_model()
    response = model.invoke(state["messages"])
    return {"messages": [response]}


def build_chat_graph():
    graph = StateGraph(ChatState)
    graph.add_node("chatbot", chatbot_node)
    graph.add_edge(START, "chatbot")
    graph.add_edge("chatbot", END)
    return graph.compile()


chat_graph = build_chat_graph()


def to_langchain_messages(
    messages: list[dict[str, str]],
) -> list[BaseMessage]:
    result: list[BaseMessage] = []
    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role == "assistant":
            result.append(AIMessage(content=content))
        else:
            result.append(HumanMessage(content=content))
    return result
