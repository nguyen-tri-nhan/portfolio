---
key: "mcp-server-build"
title: "Xây Dựng MCP Server"
crumb: "17. AI & Agents › MCP & Protocols"
---

Building một MCP server bằng Python SDK cho phép expose business logic như Tools và Resources có thể được discover và dùng bởi bất kỳ MCP-compatible LLM client nào.

## Điểm Chính

- <strong>MCP Python SDK</strong>: package `mcp` cung cấp `FastMCP` class cho rapid development với decorator syntax, xử lý protocol layer tự động.
- <strong>@mcp.tool decorator</strong>: biến Python function thành MCP tool — type hints tự động generate JSON Schema, docstring thành description.
- <strong>@mcp.resource decorator</strong>: expose data với URI pattern (`resource://category/{id}`) — LLM có thể read nhưng không trigger side effects.
- <strong>stdio transport</strong>: server chạy như subprocess, communicate qua stdin/stdout — zero network overhead, phù hợp local tools.
- <strong>SSE transport</strong>: server là HTTP server với Server-Sent Events endpoint — scalable, hỗ trợ multiple concurrent clients, phù hợp remote deployment.
- <strong>Async tools</strong>: tools nên async để không block event loop — quan trọng khi tool gọi external APIs hay database.
- <strong>Error handling</strong>: raise `Exception` trong tool → MCP SDK tự convert thành error response đúng format, LLM đọc được error message.
- <strong>Stateless vs stateful</strong>: MCP servers thường stateless (mỗi tool call independent) — state nên persist ở external store, không in-memory.

## Ví Dụ Code

*MCP server hoàn chỉnh với 2 Tools và 1 Resource — phục vụ inventory management cho e-commerce agent*

```python
import asyncio
import json
from typing import Optional
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server — name appears in client discovery
mcp = FastMCP("inventory-management-server")

# Simulated data store (in production: PostgreSQL / Redis)
PRODUCTS = {
    "P001": {"name": "Wireless Headphones", "price": 89.99, "stock": 23, "category": "electronics"},
    "P002": {"name": "Mechanical Keyboard", "price": 149.99, "stock": 8, "category": "electronics"},
    "P003": {"name": "USB-C Hub", "price": 49.99, "stock": 0, "category": "electronics"},
}

# ─── TOOLS (actions with side effects) ─────────────────────────────────────

@mcp.tool()
async def search_products(
    query: str,
    category: Optional[str] = None,
    in_stock_only: bool = False
) -> str:
    """Search products by name or description. Returns matching products with price and availability.
    Use when user asks to find, search, or browse products."""
    results = []
    for pid, product in PRODUCTS.items():
        name_match = query.lower() in product["name"].lower()
        category_match = category is None or product["category"] == category
        stock_match = not in_stock_only or product["stock"] > 0

        if name_match and category_match and stock_match:
            results.append({
                "id": pid,
                "name": product["name"],
                "price": product["price"],
                "in_stock": product["stock"] > 0,
                "stock_count": product["stock"]
            })

    if not results:
        return json.dumps({"message": f"No products found for query: '{query}'", "results": []})
    return json.dumps({"count": len(results), "results": results})


@mcp.tool()
async def update_stock(product_id: str, quantity_delta: int, reason: str) -> str:
    """Update product stock level. Use positive delta to add stock, negative to reduce.
    Requires a reason for audit trail. Use when processing orders or receiving new inventory."""
    if product_id not in PRODUCTS:
        raise ValueError(f"Product {product_id} not found")

    product = PRODUCTS[product_id]
    new_stock = product["stock"] + quantity_delta

    if new_stock < 0:
        raise ValueError(
            f"Insufficient stock. Current: {product['stock']}, attempted delta: {quantity_delta}"
        )

    PRODUCTS[product_id]["stock"] = new_stock

    # In production: write to DB + emit event to Kafka
    return json.dumps({
        "success": True,
        "product_id": product_id,
        "product_name": product["name"],
        "previous_stock": product["stock"] - quantity_delta,
        "new_stock": new_stock,
        "reason": reason
    })


# ─── RESOURCES (read-only data) ─────────────────────────────────────────────

@mcp.resource("inventory://products/{product_id}")
async def get_product_resource(product_id: str) -> str:
    """Read detailed product information including full specs and stock history.
    Returns structured product data as JSON."""
    product = PRODUCTS.get(product_id)
    if not product:
        return json.dumps({"error": f"Product {product_id} not found"})

    return json.dumps({
        "id": product_id,
        **product,
        "status": "in_stock" if product["stock"] > 0 else "out_of_stock",
        "low_stock_warning": product["stock"] < 5
    })


@mcp.resource("inventory://summary")
async def get_inventory_summary() -> str:
    """Get overall inventory summary — total products, out of stock count, low stock items."""
    out_of_stock = [pid for pid, p in PRODUCTS.items() if p["stock"] == 0]
    low_stock = [pid for pid, p in PRODUCTS.items() if 0 < p["stock"] < 5]
    total_value = sum(p["price"] * p["stock"] for p in PRODUCTS.values())

    return json.dumps({
        "total_products": len(PRODUCTS),
        "out_of_stock_count": len(out_of_stock),
        "out_of_stock_ids": out_of_stock,
        "low_stock_ids": low_stock,
        "total_inventory_value": round(total_value, 2)
    })


# ─── ENTRY POINTS ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if "--sse" in sys.argv:
        # SSE transport: run as HTTP server on port 8000
        # Multiple clients can connect; deploy on cloud/container
        mcp.run(transport="sse", host="0.0.0.0", port=8000)
    else:
        # stdio transport (default): communicate via stdin/stdout
        # Launched as subprocess by MCP host (Claude Desktop, custom agent)
        mcp.run(transport="stdio")
```

## Ứng Dụng Thực Tế

Trong microservice platform, MCP server được deploy như sidecar container với SSE transport — inventory agent, order agent, và customer support agent đều share cùng một MCP server mà không cần deploy riêng cho từng agent. Khi thêm tool mới vào MCP server, tất cả agents tự động discover capability mới thông qua `list_tools()` mà không cần update agent code.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Làm thế nào test MCP server locally trước khi tích hợp với LLM?</strong></summary>

**A:** Dùng MCP Inspector (`npx @modelcontextprotocol/inspector python server.py`) — tool này launch server, hiển thị available tools/resources, và cho phép call tools manually từ browser UI. Ngoài ra có thể viết test dùng Python MCP client trực tiếp: khởi tạo `ClientSession` với stdio transport pointing tới server, gọi `list_tools()` để verify schema, rồi `call_tool()` với test arguments. Pytest fixtures có thể manage server lifecycle (start trước test, stop sau). Trong CI, chạy MCP server trong subprocess và run integration tests against nó — không cần LLM thật.

</details>

<details>
<summary><strong>stdio vs SSE transport — khi nào chọn cái nào?</strong></summary>

**A:** stdio: server launch như subprocess của MCP host — giao tiếp qua stdin/stdout, không cần network, zero latency, tự động cleanup khi host process exit. Phù hợp cho local tools (filesystem, local DB, CLI tools) và development. SSE (HTTP): server là persistent HTTP service, nhiều clients kết nối đồng thời, có thể deploy trên Kubernetes/cloud, hỗ trợ auth via HTTP headers, dễ monitor và scale. Phù hợp cho shared infrastructure tools và production deployment. Trong production, thường dùng SSE cho central MCP servers và stdio cho developer local tooling.

</details>

<details>
<summary><strong>MCP server nên stateful hay stateless và tại sao?</strong></summary>

**A:** Stateless là best practice — mỗi tool call xử lý hoàn toàn độc lập, không giữ state in-memory giữa các calls. Lý do: SSE server có thể có nhiều instances (horizontal scaling), và không có gì đảm bảo client sẽ hit cùng một instance. State cần persist phải đặt ở external store: PostgreSQL, Redis, hoặc object storage. Trường hợp cần stateful tạm thời (browser session trong Playwright MCP): dùng session ID làm key để lookup state từ store, không giữ trong server memory. Stateless cũng giúp testing dễ hơn — không có hidden state ảnh hưởng test results.

</details>
