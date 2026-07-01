---
key: "a2a-protocol"
title: "A2A Protocol - Agent-to-Agent"
crumb: "17. AI & Agents › MCP & Protocols"
---

A2A (Agent-to-Agent) là open standard của Google cho phép các AI agent từ different vendors và frameworks giao tiếp và collaborate với nhau theo chuẩn thống nhất.

## Điểm Chính

- <strong>A2A là gì</strong>: HTTP-based protocol chuẩn hóa cách agent gọi nhau — orchestrator agent có thể delegate task cho specialist agents mà không cần biết implementation chi tiết.
- <strong>Agent Card</strong>: JSON manifest tại `/.well-known/agent.json` mô tả agent capabilities, skills, authentication requirements — tương tự OpenAPI spec nhưng cho agents.
- <strong>Task lifecycle</strong>: submitted → working → (input-required) → completed/failed/canceled — long-running tasks có state machine rõ ràng.
- <strong>Push notifications</strong>: agent gọi webhook của client khi task status thay đổi — tránh polling cho long-running tasks (data processing, code generation).
- <strong>Streaming responses</strong>: SSE stream cho progressive output — agent trả từng phần kết quả thay vì đợi đến khi xong hoàn toàn.
- <strong>MCP vs A2A</strong>: MCP = LLM ↔ external tools/data (vertical integration); A2A = agent ↔ agent (horizontal collaboration). MCP dùng trong agent; A2A dùng giữa agents.
- <strong>Multi-agent pattern</strong>: orchestrator agent nhận task từ user, phân tích, delegate sub-tasks cho specialist agents qua A2A, aggregate results, trả về user.

## Ví Dụ Code

*Orchestrator agent gọi specialist agents qua A2A protocol — Python implementation với task polling và error handling*

```python
import asyncio
import httpx
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class AgentCard:
    name: str
    url: str
    description: str
    skills: list[str]
    auth_type: str  # "none" | "bearer" | "api_key"

@dataclass
class A2ATask:
    task_id: str
    status: str  # submitted | working | input-required | completed | failed
    result: Optional[dict] = None
    error: Optional[str] = None

class A2AClient:
    """Client for calling remote agents via A2A protocol."""

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    async def discover(self) -> AgentCard:
        """Fetch Agent Card from /.well-known/agent.json"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/.well-known/agent.json",
                headers=self.headers
            )
            resp.raise_for_status()
            data = resp.json()
            return AgentCard(
                name=data["name"],
                url=self.base_url,
                description=data["description"],
                skills=[s["id"] for s in data.get("skills", [])],
                auth_type=data.get("authentication", {}).get("schemes", ["none"])[0]
            )

    async def submit_task(self, skill_id: str, input_text: str, metadata: dict = None) -> str:
        """Submit a task and return task_id."""
        payload = {
            "jsonrpc": "2.0",
            "method": "tasks/send",
            "params": {
                "skill_id": skill_id,
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": input_text}]
                },
                "metadata": metadata or {}
            },
            "id": "req-1"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/a2a",
                json=payload, headers=self.headers, timeout=30
            )
            resp.raise_for_status()
            result = resp.json()
            return result["result"]["id"]

    async def get_task(self, task_id: str) -> A2ATask:
        """Poll task status."""
        payload = {
            "jsonrpc": "2.0", "method": "tasks/get",
            "params": {"id": task_id}, "id": "req-2"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}/a2a", json=payload, headers=self.headers)
            resp.raise_for_status()
            task_data = resp.json()["result"]
            return A2ATask(
                task_id=task_id,
                status=task_data["status"]["state"],
                result=task_data.get("artifacts"),
                error=task_data["status"].get("message")
            )

    async def run_task(self, skill_id: str, input_text: str, poll_interval: float = 2.0) -> A2ATask:
        """Submit task and poll until completion."""
        task_id = await self.submit_task(skill_id, input_text)
        while True:
            task = await self.get_task(task_id)
            if task.status in ("completed", "failed", "canceled"):
                return task
            if task.status == "input-required":
                raise RuntimeError(f"Task requires additional input: {task.error}")
            await asyncio.sleep(poll_interval)


class OrchestratorAgent:
    """Orchestrator that delegates to specialist agents via A2A."""

    def __init__(self):
        self.data_agent = A2AClient("https://data-analyst-agent.internal")
        self.report_agent = A2AClient("https://report-generator-agent.internal")

    async def process_sales_report_request(self, request: str) -> str:
        """Orchestrate: data analysis → report generation."""
        print(f"Orchestrator: Processing '{request}'")

        # Step 1: delegate data analysis to specialist
        data_task = await self.data_agent.run_task(
            skill_id="analyze_sales_data",
            input_text=f"Analyze Q4 sales data: {request}"
        )
        if data_task.status == "failed":
            return f"Data analysis failed: {data_task.error}"

        analysis_result = json.dumps(data_task.result)
        print(f"Data analysis complete, result length: {len(analysis_result)} chars")

        # Step 2: delegate report generation with analysis result
        report_task = await self.report_agent.run_task(
            skill_id="generate_report",
            input_text=f"Generate executive report based on: {analysis_result}"
        )

        if report_task.status == "completed":
            return report_task.result[0].get("parts", [{}])[0].get("text", "Report generated")
        return f"Report generation failed: {report_task.error}"
```

## Ứng Dụng Thực Tế

Trong platform tự động hóa business intelligence, orchestrator agent nhận yêu cầu từ user, delegate cho data-fetching agent (Python, query Redshift), analysis agent (R-based statistical model), và visualization agent (generates Charts) — tất cả qua A2A protocol. Mỗi specialist agent có thể được develop bởi team khác nhau, dùng framework khác nhau, nhưng vẫn interoperable nhờ A2A standard.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>MCP vs A2A — khi nào dùng cái nào trong kiến trúc multi-agent?</strong></summary>

**A:** MCP và A2A giải quyết bài toán khác nhau. MCP là vertical integration: LLM/agent connect xuống tools và data sources — filesystem, database, browser, APIs. Dùng MCP khi agent cần "hands" để làm việc với external systems. A2A là horizontal collaboration: agent communicate với agent khác — orchestrator delegate tasks cho specialists. Dùng A2A khi muốn compose nhiều specialized agents lại. Trong thực tế, cùng dùng cả hai: orchestrator agent dùng A2A để gọi specialist agents, mỗi specialist agent dùng MCP để access tools riêng của mình.

</details>

<details>
<summary><strong>Agent Card là gì và tại sao quan trọng cho agent discovery?</strong></summary>

**A:** Agent Card là JSON manifest tại `/.well-known/agent.json` — analogous với OpenAPI spec nhưng cho AI agents. Nó mô tả: tên và mô tả agent, danh sách skills với id và description, authentication requirements, và URL endpoint. Quan trọng vì cho phép dynamic discovery — orchestrator có thể fetch Agent Card và biết ngay agent làm được gì mà không cần hard-code trong code. Registry service có thể index nhiều Agent Cards, cho phép orchestrator tìm đúng specialist cho task. Đây là nền tảng của composable multi-agent ecosystem.

</details>

<details>
<summary><strong>Handle long-running A2A task như thế nào trong production?</strong></summary>

**A:** Ba approach: (1) Polling — client định kỳ gọi `tasks/get` để check status, đơn giản nhưng tốn resources và có latency. (2) Push notification — khi submit task, include webhook URL; remote agent POST tới webhook khi status thay đổi — zero latency, không waste requests. (3) SSE streaming — server stream progressive output qua `tasks/sendSubscribe`, client nhận real-time updates. Trong production dùng hybrid: push notification cho task completion, SSE cho progressive output (LLM streaming), polling làm fallback khi webhook fail. Cần implement idempotency ở webhook handler để handle duplicate notifications.

</details>
