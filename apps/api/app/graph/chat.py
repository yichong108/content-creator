from typing import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.services.ai_provider import invoke_chat


class ChatState(TypedDict):
    messages: list[BaseMessage]


def chatbot_node(state: ChatState) -> ChatState:
    """LangGraph 聊天节点：委托统一 AI 提供商生成回复。

    Args:
        state: 含 LangChain 消息列表的图状态。

    Returns:
        追加助手消息后的新状态。
    """
    payload = [
        {
            "role": "assistant" if isinstance(msg, AIMessage) else "user",
            "content": str(msg.content),
        }
        for msg in state["messages"]
    ]
    content = invoke_chat(payload)
    return {"messages": [AIMessage(content=content)]}


def build_chat_graph():
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(ChatState)
    graph.add_node("chatbot", chatbot_node)
    graph.add_edge(START, "chatbot")
    graph.add_edge("chatbot", END)
    return graph.compile()


chat_graph = build_chat_graph()


def to_langchain_messages(
    messages: list[dict[str, str]],
) -> list[BaseMessage]:
    """将 API 消息字典转为 LangChain 消息列表。

    Args:
        messages: 含 role/content 的请求消息。

    Returns:
        LangChain ``BaseMessage`` 列表。
    """
    result: list[BaseMessage] = []
    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role == "assistant":
            result.append(AIMessage(content=content))
        else:
            result.append(HumanMessage(content=content))
    return result
