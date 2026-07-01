---
key: "google-adk"
title: "Google Agent Development Kit (ADK)"
crumb: "17. AI & Agents › Frameworks"
---

Google ADK là Python framework chuẩn hóa việc build production AI agents với Gemini, hỗ trợ multi-agent orchestration, built-in tools, và native Vertex AI deployment.

## Điểm Chính

- <strong>Core concepts</strong>: Agent (logic unit), Tool (callable action), Runner (execution engine), Session (conversation state) — 4 abstractions cốt lõi của ADK.
- <strong>LlmAgent</strong>: agent dùng LLM để reasoning và quyết định — nhận system prompt, tool list, tự chọn khi nào gọi tool và khi nào trả lời.
- <strong>SequentialAgent</strong>: chạy danh sách sub-agents theo thứ tự cố định — output của agent trước làm input cho agent sau, phù hợp pipeline.
- <strong>ParallelAgent</strong>: chạy nhiều sub-agents đồng thời, aggregate results — giảm latency khi sub-agents độc lập nhau.
- <strong>LoopAgent</strong>: chạy agent trong vòng lặp với điều kiện dừng — phù hợp cho refinement tasks, retry logic, và iterative processing.
- <strong>Multi-agent delegation</strong>: parent LlmAgent có sub-agents như một loại "tool" — LLM tự quyết định khi nào transfer control cho sub-agent.
- <strong>Built-in tools</strong>: `google_search`, `code_execution`, `vertex_ai_search` — không cần implement, sẵn sàng dùng.
- <strong>Session management</strong>: ADK quản lý conversation history và agent state tự động qua `InMemorySessionService` hoặc custom persistent store.

## Ví Dụ Code

*Multi-agent system với ADK: orchestrator LlmAgent điều phối SequentialAgent và specialist agents để xử lý customer complaint*

```python
import asyncio
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from google.adk.tools import FunctionTool
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types

# ─── Tool definitions ──────────────────────────────────────────────────────

async def fetch_order_details(order_id: str) -> dict:
    """Fetch order information from order service."""
    # In production: call order microservice
    return {
        "order_id": order_id,
        "status": "delivered",
        "items": [{"name": "Wireless Headphones", "qty": 1, "price": 89.99}],
        "delivery_date": "2026-06-28",
        "customer_id": "USR-001"
    }

async def check_return_eligibility(order_id: str) -> dict:
    """Check if order is eligible for return within policy window."""
    return {"eligible": True, "reason": "Within 30-day return window", "refund_amount": 89.99}

async def initiate_refund(order_id: str, amount: float, reason: str) -> dict:
    """Initiate refund process for an order."""
    return {"success": True, "refund_id": f"REF-{order_id}", "estimated_days": 3}

async def send_notification(customer_id: str, message: str, channel: str = "email") -> dict:
    """Send notification to customer via email or SMS."""
    return {"sent": True, "channel": channel, "customer_id": customer_id}

# ─── Specialist Agents ─────────────────────────────────────────────────────

order_lookup_agent = LlmAgent(
    name="OrderLookupAgent",
    model="gemini-2.0-flash",
    instruction="""You are an order lookup specialist. 
    Fetch order details and check return eligibility.
    Always provide clear summary of what you found.""",
    tools=[
        FunctionTool(fetch_order_details),
        FunctionTool(check_return_eligibility),
    ],
    output_key="order_analysis"  # Store result in session state
)

refund_processing_agent = LlmAgent(
    name="RefundProcessingAgent",
    model="gemini-2.0-flash",
    instruction="""You are a refund processing specialist.
    Based on order analysis from session state, initiate refund and notify customer.
    Use order_analysis from context to get order details.""",
    tools=[
        FunctionTool(initiate_refund),
        FunctionTool(send_notification),
    ],
    output_key="refund_result"
)

# ─── Pipeline: lookup → process (sequential dependency) ───────────────────

complaint_pipeline = SequentialAgent(
    name="ComplaintResolutionPipeline",
    sub_agents=[order_lookup_agent, refund_processing_agent],
    description="Handles order complaints: looks up order then processes refund"
)

# ─── Orchestrator: routes different complaint types ────────────────────────

orchestrator = LlmAgent(
    name="CustomerSupportOrchestrator",
    model="gemini-2.0-flash",
    instruction="""You are a customer support orchestrator.
    For order complaints involving refunds: delegate to ComplaintResolutionPipeline.
    For general product questions: answer directly using your knowledge.
    Always be empathetic and professional.""",
    sub_agents=[complaint_pipeline],
)

# ─── Runner setup ──────────────────────────────────────────────────────────

async def handle_customer_request(user_input: str, session_id: str = "session-001"):
    session_service = InMemorySessionService()
    runner = Runner(
        agent=orchestrator,
        app_name="customer-support",
        session_service=session_service
    )

    session = await session_service.create_session(
        app_name="customer-support",
        user_id="user-001",
        session_id=session_id
    )

    message = types.Content(role="user", parts=[types.Part(text=user_input)])
    async for event in runner.run_async(
        user_id="user-001",
        session_id=session_id,
        new_message=message
    ):
        if event.is_final_response():
            return event.content.parts[0].text

    return "No response generated"

if __name__ == "__main__":
    result = asyncio.run(
        handle_customer_request("I received my order ORD-001 but want to return it. Help me.")
    )
    print(result)
```

## Ứng Dụng Thực Tế

Trong SaaS platform, ADK multi-agent system xử lý end-to-end user onboarding: orchestrator agent phân tích yêu cầu, SequentialAgent thực hiện account setup → email verification → data migration, trong khi ParallelAgent đồng thời trigger welcome email và CRM update. LoopAgent được dùng để retry failed migration steps tối đa 3 lần với exponential backoff.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>ADK LoopAgent vs SequentialAgent — khi nào dùng cái nào?</strong></summary>

**A:** SequentialAgent chạy một danh sách agent theo thứ tự cố định, mỗi agent chạy một lần — phù hợp pipeline rõ ràng như load → transform → validate → store. LoopAgent chạy một agent (hoặc sub-agent) lặp đi lặp lại cho đến khi điều kiện dừng thỏa mãn — phù hợp khi số iterations không biết trước, như refinement (sửa code cho đến khi test pass), polling (check status cho đến khi done), hay retry với backoff. Kết hợp: SequentialAgent cho high-level pipeline, LoopAgent lồng bên trong cho từng bước cần retry hoặc refinement.

</details>

<details>
<summary><strong>Làm thế nào share context giữa các sub-agents trong ADK multi-agent?</strong></summary>

**A:** ADK dùng Session State như shared memory giữa agents. Mỗi LlmAgent có thể set `output_key` — kết quả của agent đó được lưu vào session state với key đó. Agent khác trong cùng pipeline có thể đọc giá trị này từ `context.session.state["key_name"]` hoặc inject vào system prompt via `{key_name}` placeholder. Ngoài ra, ADK truyền conversation history qua toàn bộ agent hierarchy — sub-agents đọc được previous messages. Đây là cơ chế để SequentialAgent pipeline share information mà không cần custom data passing code.

</details>

<details>
<summary><strong>ADK vs LangGraph — khi nào chọn framework nào?</strong></summary>

**A:** ADK tối ưu cho Google ecosystem (Gemini, Vertex AI, Google Cloud), có native A2A support, deployment đơn giản lên Vertex AI Agent Engine. Agent types (Sequential/Parallel/Loop) được build-in với sane defaults. Chọn ADK khi team đã dùng GCP, cần production deployment nhanh, và bài toán fit với predefined agent patterns. LangGraph linh hoạt hơn — graph-based với custom nodes và edges, không tied với vendor, hỗ trợ complex conditional workflows, human-in-the-loop. Chọn LangGraph khi cần fine-grained control, phức tạp về routing logic, hoặc cần multi-vendor LLM support. ADK phù hợp product teams; LangGraph phù hợp teams cần flexibility tối đa.

</details>
