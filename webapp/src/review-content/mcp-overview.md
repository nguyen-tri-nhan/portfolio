---
key: "mcp-overview"
title: "MCP - Model Context Protocol"
crumb: "17. AI & Agents › MCP & Protocols"
---

MCP là open standard do Anthropic định nghĩa, chuẩn hóa cách LLM giao tiếp với external systems thông qua ba primitives: Tools, Resources, và Prompts.

## Điểm Chính

- <strong>MCP là gì</strong>: protocol mở, không phụ thuộc vendor, cho phép bất kỳ LLM nào connect với bất kỳ external system nào theo chuẩn thống nhất — giống USB-C cho AI.
- <strong>Tools</strong>: actions LLM có thể trigger (execute code, call API, write file) — có side effects, LLM gọi với arguments.
- <strong>Resources</strong>: data sources LLM có thể đọc (files, database records, API responses) — read-only, có URI pattern như `file:///path` hoặc `db://table/id`.
- <strong>Prompts</strong>: prompt templates có thể parameterized — cho phép user invoke predefined prompts với arguments.
- <strong>Architecture</strong>: MCP Host (application/LLM client) ↔ MCP Client (protocol layer) ↔ MCP Server (exposes tools/resources).
- <strong>Transport</strong>: stdio (local process, low latency) hoặc SSE/HTTP (remote server, scalable) — server không biết transport nào đang được dùng.
- <strong>MCP vs REST API</strong>: REST là ad-hoc per-service; MCP là standardized — LLM tự discover available tools, schema tự describe, composable với multiple servers.
- <strong>Ecosystem</strong>: Playwright MCP, Filesystem MCP, GitHub MCP, Postgres MCP — tái sử dụng mà không cần viết integration code.

## Ví Dụ Code

*MCP client trong Python — connect tới Playwright MCP server và invoke tool để automate browser*

```python
import asyncio
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def run_with_playwright_mcp():
    """Connect to Playwright MCP server and use browser automation tools."""

    server_params = StdioServerParameters(
        command="npx",
        args=["@playwright/mcp@latest"],
        env=None
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize — server sends its capabilities
            await session.initialize()

            # Discover available tools (MCP auto-discovery)
            tools_result = await session.list_tools()
            print("Available MCP tools:")
            for tool in tools_result.tools:
                print(f"  - {tool.name}: {tool.description[:60]}...")

            # Discover available resources
            resources_result = await session.list_resources()
            print(f"\nAvailable resources: {len(resources_result.resources)}")

            # Invoke a tool: navigate browser to a URL
            nav_result = await session.call_tool(
                "browser_navigate",
                arguments={"url": "https://example-ecommerce.com/products"}
            )
            print(f"\nNavigation result: {nav_result.content[0].text[:100]}")

            # Take screenshot (Tool → returns image resource)
            screenshot_result = await session.call_tool(
                "browser_screenshot",
                arguments={}
            )

            # Read a resource: get page content as structured data
            # Resources use URI pattern — discoverable at runtime
            if resources_result.resources:
                resource = resources_result.resources[0]
                content = await session.read_resource(resource.uri)
                print(f"\nResource content type: {content.contents[0].mimeType}")

            # Use a prompt template
            prompts_result = await session.list_prompts()
            if prompts_result.prompts:
                prompt = await session.get_prompt(
                    prompts_result.prompts[0].name,
                    arguments={"topic": "product listing"}
                )
                print(f"\nPrompt template: {prompt.messages[0].content.text[:80]}...")

            return screenshot_result

async def demonstrate_mcp_vs_rest():
    """Conceptual comparison: MCP tool call vs direct REST API call."""

    # ❌ REST approach: hard-coded per service
    # import httpx
    # response = await httpx.get("https://api.service.com/v1/data", headers={"Authorization": "Bearer ..."})
    # Must know URL, auth, schema ahead of time — not composable

    # ✅ MCP approach: standardized, discoverable, composable
    # 1. LLM receives tool schema from MCP server at runtime
    # 2. LLM decides WHEN to call it based on description
    # 3. LLM generates arguments using JSON Schema
    # 4. MCP client handles transport (stdio/SSE)
    # 5. Same pattern works for ANY MCP-compliant server

    mcp_tool_schema_example = {
        "name": "search_products",
        "description": "Search product catalog. Use when user asks to find products by name, category, or price range.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "max_price": {"type": "number", "description": "Maximum price filter"},
                "category": {"type": "string", "enum": ["electronics", "clothing", "food"]}
            },
            "required": ["query"]
        }
    }
    return mcp_tool_schema_example

if __name__ == "__main__":
    asyncio.run(run_with_playwright_mcp())
```

## Ứng Dụng Thực Tế

Trong CI/CD pipeline của microservice system, Playwright MCP server được dùng để agent tự động chạy E2E tests, chụp screenshot khi fail, và analyze lỗi — tất cả thông qua cùng một MCP interface mà không cần viết custom integration code cho từng use case. MCP giúp team reuse Playwright MCP server ở nhiều contexts: local testing, CI agent, và monitoring agent — chỉ thay đổi MCP Host.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>MCP khác REST API call thông thường thế nào về mặt kiến trúc?</strong></summary>

**A:** REST API là point-to-point integration: developer viết code hard-code URL, auth, schema parsing riêng cho từng service. MCP là standardized middleware layer: LLM tự discover tools và schemas tại runtime thông qua `list_tools()`, không cần hard-code. Quan trọng hơn, MCP có tính composable — một LLM host có thể connect nhiều MCP servers đồng thời và LLM tự chọn tool phù hợp từ tổng hợp tools của tất cả servers. MCP cũng tách biệt transport (stdio/SSE) khỏi application logic — cùng một MCP server chạy được local (stdio) hoặc remote (SSE).

</details>

<details>
<summary><strong>Tools vs Resources trong MCP — khi nào dùng cái nào?</strong></summary>

**A:** Tools có side effects và là "actions" — gọi API, write file, execute code, trigger workflow. LLM call tool khi cần thực hiện hành động. Resources là "data sources" read-only — files, database records, real-time metrics. LLM đọc resource khi cần context hay information mà không muốn trigger side effect. Trong practice: `run_test_suite` là Tool (có side effect); `get_test_results` hay `read_config_file` là Resource (read-only). Phân tách rõ giúp LLM reasoning đúng hơn về consequences của actions và giúp implement proper authorization (resources có thể public hơn tools).

</details>

<details>
<summary><strong>Khi nào nên build MCP server thay vì dùng function calling trực tiếp?</strong></summary>

**A:** Build MCP server khi: (1) Tool cần được reuse ở nhiều agents/applications khác nhau — MCP cho phép share tool mà không copy code; (2) Team không phải AI muốn expose capabilities cho AI agents — viết một MCP server, AI teams tự dùng; (3) Tools có thể được compose với ecosystem MCP servers khác (Playwright + Filesystem + GitHub); (4) Cần dynamic tool discovery thay vì hard-code schema. Dùng function calling trực tiếp khi: tool chỉ dùng cho một agent cụ thể, cần full control không qua abstraction layer, hoặc performance-critical và không muốn overhead của MCP protocol.

</details>
