---
key: "function-calling"
title: "Function Calling & Tool Use"
crumb: "17. AI & Agents › AI Agent Fundamentals"
---

Function calling cho phép LLM tạo ra JSON structured output để trigger code thực thi, biến LLM từ text generator thành orchestrator của real-world actions.

## Điểm Chính

- <strong>Cơ chế hoạt động</strong>: LLM nhận tool schema → sinh JSON call → app thực thi function thật → trả kết quả về conversation → LLM tiếp tục reasoning.
- <strong>Tool schema</strong>: gồm `name`, `description` (quan trọng nhất — LLM đọc để quyết định dùng khi nào), và `parameters` (JSON Schema với type, required, enum).
- <strong>Parallel tool calls</strong>: LLM sinh nhiều tool call trong cùng một response — app thực thi đồng thời, giảm latency tổng thể đáng kể.
- <strong>Sequential tool calls</strong>: tool call sau phụ thuộc kết quả tool trước — không thể parallel, phổ biến trong multi-step reasoning.
- <strong>Tool choice</strong>: `auto` (LLM tự quyết), `required` (buộc phải gọi tool), `none` (chỉ text response), hoặc chỉ định tool cụ thể.
- <strong>OpenAI format</strong>: `tools` array với `function` object; response có `tool_calls` với `id`, `name`, `arguments` (JSON string).
- <strong>Anthropic format</strong>: `tools` array trực tiếp; response `content` có block type `tool_use` với `id`, `name`, `input` (parsed dict).
- <strong>Error handling</strong>: tool execution có thể fail — phải trả về error message có ý nghĩa để LLM có thể retry hay fallback thay vì crash.

## Ví Dụ Code

*Function calling với OpenAI format — parallel execution, error handling, và tool result trả về đúng cách*

```python
import asyncio
import json
from openai import AsyncOpenAI

client = AsyncOpenAI()

# Tool implementations
async def get_user_orders(user_id: str, limit: int = 10) -> dict:
    # In production: query database
    return {
        "user_id": user_id,
        "orders": [
            {"id": "ORD-001", "status": "delivered", "total": 150.0},
            {"id": "ORD-002", "status": "processing", "total": 89.99},
        ][:limit]
    }

async def get_product_details(product_id: str) -> dict:
    # In production: fetch from catalog service
    return {"id": product_id, "name": "Wireless Headphones", "price": 89.99, "stock": 23}

async def cancel_order(order_id: str, reason: str) -> dict:
    # In production: call order service
    if not order_id.startswith("ORD-"):
        raise ValueError(f"Invalid order ID format: {order_id}")
    return {"success": True, "order_id": order_id, "refund_initiated": True}

TOOL_MAP = {
    "get_user_orders": get_user_orders,
    "get_product_details": get_product_details,
    "cancel_order": cancel_order,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_orders",
            "description": "Get list of orders for a specific user. Use when user asks about their order history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "The user's unique ID"},
                    "limit": {"type": "integer", "description": "Max orders to return", "default": 10}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_order",
            "description": "Cancel a specific order. Requires order ID and cancellation reason.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "Order ID to cancel"},
                    "reason": {"type": "string", "description": "Reason for cancellation"}
                },
                "required": ["order_id", "reason"]
            }
        }
    }
]

async def execute_tool_calls(tool_calls: list) -> list[dict]:
    """Execute multiple tool calls in parallel."""
    async def run_one(tc):
        fn = TOOL_MAP.get(tc.function.name)
        if not fn:
            return {"tool_call_id": tc.id, "role": "tool",
                    "content": json.dumps({"error": f"Unknown tool: {tc.function.name}"})}
        try:
            args = json.loads(tc.function.arguments)
            result = await fn(**args)
            return {"tool_call_id": tc.id, "role": "tool", "content": json.dumps(result)}
        except Exception as e:
            return {"tool_call_id": tc.id, "role": "tool",
                    "content": json.dumps({"error": str(e)})}

    return await asyncio.gather(*[run_one(tc) for tc in tool_calls])

async def chat_with_tools(user_message: str, user_id: str):
    messages = [
        {"role": "system", "content": "You are a helpful customer support agent."},
        {"role": "user", "content": user_message}
    ]

    while True:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto"
        )
        msg = response.choices[0].message
        messages.append(msg)

        if not msg.tool_calls:
            return msg.content  # Final text response

        # Execute all tool calls in parallel
        tool_results = await execute_tool_calls(msg.tool_calls)
        messages.extend(tool_results)
```

## Ứng Dụng Thực Tế

Trong customer support chatbot của SaaS platform, function calling cho phép LLM tự động look up account info, check subscription status, và trigger refund — tất cả trong một conversation flow tự nhiên mà không cần user navigate qua multiple screens. Parallel tool calls đặc biệt hữu ích khi cần fetch data từ nhiều microservice độc lập cùng lúc.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>LLM biết gọi tool đúng lúc nào và tại sao description quan trọng?</strong></summary>

**A:** LLM quyết định gọi tool dựa vào `description` field trong schema — đây là "hướng dẫn sử dụng" mà LLM đọc để biết tool làm gì và khi nào nên dùng. Description tốt phải nêu rõ: tool làm gì, nhận input gì, khi nào nên/không nên dùng. Ví dụ: "Use when user asks about ORDER STATUS" tốt hơn "Get order info" vì nó contextual. Parameter description cũng quan trọng — LLM dùng để extract đúng giá trị từ natural language của user. Tool description tệ là nguyên nhân phổ biến nhất khiến agent gọi sai tool hoặc không gọi tool khi cần.

</details>

<details>
<summary><strong>Parallel vs sequential tool calls — khi nào dùng cái nào?</strong></summary>

**A:** Parallel tool calls khi các tool độc lập nhau — LLM sinh nhiều `tool_calls` trong một response, app execute đồng thời bằng `asyncio.gather()`. Ví dụ: fetch user profile + fetch order list + check promotions cùng lúc. Sequential khi tool sau phụ thuộc kết quả tool trước — ví dụ: phải `search_product` trước, lấy `product_id`, mới `check_inventory(product_id)`. Trong thực tế, LLM hiện đại (GPT-4o, Gemini 1.5) tự nhận ra dependency và chọn đúng pattern. Latency improvement của parallel có thể 2-5x khi fetch từ nhiều services.

</details>

<details>
<summary><strong>Handle tool error như thế nào để agent không bị stuck?</strong></summary>

**A:** Không nên throw exception hay crash — thay vào đó trả về error message có cấu trúc trong tool result để LLM có thể xử lý tiếp. Ví dụ: `{"error": "Order ORD-999 not found", "suggestion": "Try checking order ID format"}`. LLM đọc error này sẽ tự quyết định: retry với input khác, ask user for clarification, hay inform user về failure. Cần phân loại: transient error (network timeout → retry), user error (invalid input → ask clarification), system error (service down → graceful degradation). Luôn log tool failures với full context để debug production issues.

</details>
