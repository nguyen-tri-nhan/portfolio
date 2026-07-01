---
key: "llm-gateway"
title: "LLM Gateway & LiteLLM"
crumb: "17. AI & Agents › Production AI"
---

LLM Gateway là abstraction layer giữa application và LLM providers — cung cấp unified API, fallback, cost control, và observability mà không cần change application code khi switch provider.

## Điểm Chính

- <strong>LiteLLM</strong>: open-source Python library và proxy server hỗ trợ 100+ LLM providers (OpenAI, Anthropic, Gemini, Azure, Ollama...) với OpenAI-compatible API format.
- <strong>Unified API</strong>: dùng cùng code cho tất cả providers — chỉ thay `model` string, không cần import SDK riêng hay change request format.
- <strong>Fallback</strong>: define primary model và fallback list — khi primary timeout hoặc rate limit, LiteLLM tự retry với fallback model, transparent với caller.
- <strong>Load balancing</strong>: distribute requests across multiple deployments của cùng model (e.g., nhiều Azure OpenAI endpoints) — increase throughput và redundancy.
- <strong>Cost tracking</strong>: LiteLLM track token usage và cost per request, per user, per project — query qua `/spend/logs` endpoint.
- <strong>Semantic caching</strong>: cache responses bằng embedding similarity — tương tự query trả về cached response, giảm cost và latency đáng kể.
- <strong>Rate limiting</strong>: per-user, per-team, hay global limits — prevent một user abuse và burn budget của team.
- <strong>Router strategies</strong>: `simple-shuffle` (random), `least-busy` (fewest in-flight requests), `latency-based` (track p50/p95 và route tới fastest).

## Ví Dụ Code

*LiteLLM proxy config và Python client — fallback, semantic cache, cost tracking, và custom routing*

```python
# ─── LiteLLM Proxy Config (config.yaml) ─────────────────────────────────────
# litellm --config config.yaml --port 4000

"""
model_list:
  - model_name: gpt-4o           # Alias used by clients
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      rpm: 500                   # Rate limit: requests per minute
      tpm: 200000                # Token limit per minute

  - model_name: gpt-4o           # Fallback: same alias, different provider
    litellm_params:
      model: azure/gpt-4o-deployment
      api_base: https://myazure.openai.azure.com
      api_key: os.environ/AZURE_API_KEY
      rpm: 300

  - model_name: claude-3-5-haiku  # Cheaper model for simple tasks
    litellm_params:
      model: anthropic/claude-3-5-haiku-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gemini-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GEMINI_API_KEY

router_settings:
  routing_strategy: latency-based-routing
  num_retries: 3
  retry_after: 5
  fallbacks:
    - {"gpt-4o": ["claude-3-5-haiku", "gemini-flash"]}  # Fallback chain

litellm_settings:
  success_callback: ["langfuse"]  # Observability integration
  failure_callback: ["langfuse"]
  cache: true
  cache_params:
    type: "redis"
    host: "redis-host"
    port: 6379
    ttl: 3600            # Cache TTL in seconds
    similarity_threshold: 0.92  # Semantic cache threshold

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL  # For spend tracking
"""

# ─── Python Client (calls LiteLLM proxy like OpenAI) ─────────────────────────

import asyncio
from openai import AsyncOpenAI
from typing import Optional
import time

# Point OpenAI client to LiteLLM proxy — zero code change needed
gateway_client = AsyncOpenAI(
    base_url="http://localhost:4000",  # LiteLLM proxy URL
    api_key="sk-your-litellm-master-key"
)

async def smart_completion(
    prompt: str,
    task_type: str = "general",  # "general" | "simple" | "complex"
    user_id: Optional[str] = None
) -> dict:
    """Route to appropriate model based on task complexity and track cost."""

    # Model selection strategy: match complexity to cost
    model_map = {
        "simple": "claude-3-5-haiku",    # Fast, cheap — classification, extraction
        "general": "gpt-4o",             # Balanced — most tasks
        "complex": "gpt-4o",             # Use gpt-4o; gateway handles fallback to claude
    }
    model = model_map.get(task_type, "gpt-4o")

    start_time = time.time()
    response = await gateway_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        extra_headers={
            "x-litellm-user-id": user_id or "anonymous",  # For per-user cost tracking
        },
        timeout=30.0
    )
    latency_ms = (time.time() - start_time) * 1000

    return {
        "content": response.choices[0].message.content,
        "model_used": response.model,  # May differ from requested if fallback triggered
        "input_tokens": response.usage.prompt_tokens,
        "output_tokens": response.usage.completion_tokens,
        "cost_usd": getattr(response, "_hidden_params", {}).get("response_cost", 0),
        "latency_ms": round(latency_ms, 2),
        "cached": getattr(response, "_hidden_params", {}).get("cache_hit", False)
    }

async def batch_with_cost_control(
    prompts: list[str],
    budget_usd: float = 1.0,
    user_id: str = "batch-job"
) -> list[dict]:
    """Process batch with budget guard — stop if cost exceeded."""
    results = []
    total_cost = 0.0

    for i, prompt in enumerate(prompts):
        if total_cost >= budget_usd:
            print(f"Budget exhausted after {i} requests (${total_cost:.4f})")
            break

        result = await smart_completion(
            prompt,
            task_type="simple",  # Use cheap model for batch
            user_id=user_id
        )
        total_cost += result.get("cost_usd", 0)
        results.append(result)
        print(f"[{i+1}/{len(prompts)}] Cost so far: ${total_cost:.4f} | Cached: {result['cached']}")

    return results

# ─── Health check and model availability ─────────────────────────────────────

import httpx

async def check_gateway_health() -> dict:
    """Check which models are currently available."""
    async with httpx.AsyncClient() as client:
        resp = await client.get("http://localhost:4000/health")
        return resp.json()

if __name__ == "__main__":
    result = asyncio.run(smart_completion(
        "Summarize the key benefits of microservice architecture in 3 bullet points",
        task_type="simple",
        user_id="demo-user"
    ))
    print(f"Response: {result['content'][:100]}...")
    print(f"Model: {result['model_used']} | Cost: ${result['cost_usd']:.6f} | Cached: {result['cached']}")
```

## Ứng Dụng Thực Tế

Trong multi-tenant SaaS platform với 50+ enterprise customers, LiteLLM proxy giúp implement per-customer budget limits và usage tracking mà không cần change application code. Khi OpenAI có outage, fallback tự động sang Anthropic Claude xảy ra trong < 5 giây, transparent với end users. Semantic caching giảm 30-40% cost cho document processing workflows có nhiều similar queries.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Tại sao cần LLM gateway thay vì gọi trực tiếp provider API?</strong></summary>

**A:** Gọi trực tiếp tạo tight coupling: code phụ thuộc SDK cụ thể, không có fallback khi provider down, không có unified cost visibility. LLM gateway giải quyết: (1) Provider abstraction — switch model/provider chỉ thay config, không thay code; (2) Reliability — automatic fallback khi primary provider fail; (3) Cost control — rate limiting, budget caps, usage tracking; (4) Observability — centralized logging tất cả LLM requests; (5) Security — API keys không distributed tới từng service, chỉ gateway biết. Trong microservice architecture, gateway còn giúp không mỗi service phải implement retry logic và error handling riêng.

</details>

<details>
<summary><strong>Configure fallback trong LiteLLM như thế nào và hoạt động ra sao?</strong></summary>

**A:** Trong `config.yaml`, define `fallbacks` list dưới `router_settings`: `fallbacks: [{"gpt-4o": ["claude-3-5-haiku", "gemini-flash"]}]`. Khi request tới `gpt-4o` fail (rate limit 429, timeout, server error 5xx), LiteLLM router tự động retry với model tiếp trong list — `claude-3-5-haiku` trước, nếu cũng fail thì `gemini-flash`. Response trả về client chứa actual model used trong `response.model` field. Có thể configure `num_retries` (retry same model trước khi fallback) và `retry_after` (wait time). Fallback không trigger cho user error (400 bad request) — chỉ trigger cho provider-side failures.

</details>

<details>
<summary><strong>Cost control strategies khi build LLM-powered features trong production?</strong></summary>

**A:** Multi-layered approach: (1) Model routing — dùng cheap models (Haiku, Flash, gpt-4o-mini) cho simple tasks (classification, extraction), premium models chỉ khi cần; (2) Semantic caching — cache similar queries, LiteLLM cache hit rate thường 20-40% cho typical workloads; (3) Prompt optimization — measure token count, cắt verbose prompts; (4) Per-user limits — prevent abuse với rate limits và monthly budget caps; (5) Streaming — stream response thay vì wait for full response giúp detect early termination khi response đủ; (6) Monitoring — alert khi daily spend vượt threshold, review top-cost queries để optimize. Target: track cost per feature và per user để price product correctly.

</details>
