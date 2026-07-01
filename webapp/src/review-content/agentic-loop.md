---
key: "agentic-loop"
title: "Agentic Loop & ReAct Pattern"
crumb: "17. AI & Agents › AI Agent Fundamentals"
---

AI Agent hoạt động theo vòng lặp perception → reasoning → action, khác với single-shot LLM call ở chỗ agent tự quyết định khi nào dừng và có thể thực hiện nhiều bước liên tiếp.

## Điểm Chính

- <strong>Agentic loop</strong>: agent liên tục nhận observation, suy luận, chọn action, thực thi, rồi lặp lại cho đến khi đạt stopping condition.
- <strong>ReAct pattern</strong> (Reasoning + Acting): mỗi iteration gồm 3 bước — Thought (phân tích), Action (gọi tool), Observation (nhận kết quả) — giúp LLM trace dễ debug hơn.
- <strong>Single-shot vs agentic</strong>: single-shot gọi LLM một lần và trả kết quả; agentic loop cho phép multi-step reasoning, sử dụng nhiều tool, xử lý kết quả trung gian.
- <strong>Planning strategies</strong>: zero-shot ReAct (không ví dụ), chain-of-thought (think step by step), tree-of-thought (khám phá nhiều nhánh song song).
- <strong>Stopping conditions</strong>: task complete (agent tự nhận biết), max iterations (ngăn vòng lặp vô tận), error threshold (quá nhiều lần fail liên tiếp), time budget.
- <strong>LoopAgent trong Google ADK</strong>: tự động retry và kiểm tra điều kiện dừng sau mỗi iteration, phù hợp cho các task cần refinement.
- <strong>Observation quality</strong>: kết quả tool trả về phải đủ ngắn gọn và có cấu trúc — context window giới hạn số bước agent có thể thực hiện.

## Ví Dụ Code

*ReAct agent loop tự implement với Google Gemini — trace rõ Thought/Action/Observation từng bước*

```python
import google.generativeai as genai
import json
from typing import Any

# Tool definitions
def search_product(query: str) -> dict:
    """Simulate product search in e-commerce catalog."""
    return {"results": [{"id": "P001", "name": "Laptop Pro", "price": 1299}]}

def check_inventory(product_id: str) -> dict:
    """Check stock availability."""
    return {"product_id": product_id, "in_stock": True, "quantity": 15}

def calculate_discount(price: float, user_tier: str) -> dict:
    """Calculate user-tier discount."""
    rates = {"gold": 0.15, "silver": 0.10, "basic": 0.05}
    rate = rates.get(user_tier, 0)
    return {"original": price, "discount": price * rate, "final": price * (1 - rate)}

TOOLS = {
    "search_product": search_product,
    "check_inventory": check_inventory,
    "calculate_discount": calculate_discount,
}

SYSTEM_PROMPT = """You are a shopping assistant. Use available tools to help users.
For each step, output:
Thought: <reasoning>
Action: <tool_name>
Action Input: <json arguments>
When you have the final answer, output:
Final Answer: <answer>"""

def run_react_agent(user_query: str, max_iterations: int = 5) -> str:
    model = genai.GenerativeModel("gemini-1.5-pro")
    messages = [{"role": "user", "parts": [f"{SYSTEM_PROMPT}\n\nUser: {user_query}"]}]

    for iteration in range(max_iterations):
        response = model.generate_content(messages)
        text = response.text.strip()
        print(f"\n[Iteration {iteration + 1}]\n{text}")

        if "Final Answer:" in text:
            return text.split("Final Answer:")[-1].strip()

        # Parse Action and Action Input
        if "Action:" in text and "Action Input:" in text:
            action = text.split("Action:")[-1].split("\n")[0].strip()
            action_input_str = text.split("Action Input:")[-1].strip()

            try:
                action_input = json.loads(action_input_str.split("\n")[0])
                tool_fn = TOOLS.get(action)
                if tool_fn:
                    observation = tool_fn(**action_input)
                else:
                    observation = {"error": f"Unknown tool: {action}"}
            except Exception as e:
                observation = {"error": str(e)}

            # Append observation back to conversation
            messages.append({"role": "model", "parts": [text]})
            messages.append({"role": "user", "parts": [f"Observation: {json.dumps(observation)}"]})

    return "Max iterations reached without final answer."

# Usage
result = run_react_agent(
    "Find Laptop Pro, check if it's in stock, and calculate price for gold tier user"
)
print(f"\nResult: {result}")
```

## Ứng Dụng Thực Tế

Trong hệ thống e-commerce, agentic loop được dùng cho order processing assistant: agent tự search catalog, check inventory, apply promotions, rồi xác nhận order — mỗi bước là một tool call riêng biệt. ReAct pattern giúp team debug dễ vì mỗi Thought/Action/Observation đều được log, dễ trace khi agent ra quyết định sai.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ReAct pattern là gì và tại sao hiệu quả hơn single-shot LLM call?</strong></summary>

**A:** ReAct (Reasoning + Acting) là pattern trong đó agent xen kẽ giữa bước Thought (suy luận bằng ngôn ngữ tự nhiên), Action (gọi tool), và Observation (nhận kết quả) trước khi đưa ra câu trả lời cuối. Hiệu quả hơn single-shot vì LLM không cần "đoán" toàn bộ answer trong một bước — nó có thể gather information dần dần, điều chỉnh plan dựa trên kết quả thực tế, và xử lý các trường hợp không lường trước được. Ngoài ra, Thought step giúp LLM tránh hallucination bằng cách buộc phải "think before act", còn Observation step đưa ground truth vào context.

</details>

<details>
<summary><strong>Khi nào agent loop không kết thúc và cách handle?</strong></summary>

**A:** Agent loop có thể không kết thúc khi: LLM liên tục gọi cùng một tool với output không thay đổi (oscillation), task quá mơ hồ khiến agent không biết "done" là gì, hay tool trả về lỗi nhưng agent cứ retry mãi. Cách handle: luôn đặt `max_iterations` cứng (thường 10-15), track số lần gọi cùng tool để detect loop, thêm explicit stopping condition trong system prompt ("output DONE when task is complete"), và monitor wall-clock time budget. Trong production, nên có circuit breaker ở infrastructure level.

</details>

<details>
<summary><strong>Sự khác biệt giữa agent và chain (LangChain) là gì?</strong></summary>

**A:** Chain là sequence cố định các bước được định nghĩa trước — developer quyết định flow tại code time. Agent thì ngược lại: LLM tự quyết định bước tiếp theo là gì dựa trên context hiện tại — flow là dynamic và không biết trước. Chain phù hợp khi workflow ổn định và predictable (e.g., extract → transform → store); agent phù hợp khi cần adaptive reasoning, số bước không xác định, hoặc cần chọn tool từ một tập lớn. Tradeoff: chain dễ debug và predictable hơn; agent linh hoạt hơn nhưng khó kiểm soát và tốn token hơn.

</details>
