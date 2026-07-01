---
key: "ai-observability"
title: "AI Observability & Evals"
crumb: "17. AI & Agents › Production AI"
---

LLM non-deterministic và khó debug theo cách truyền thống — AI observability cung cấp tracing, evals, và guardrails để hiểu, measure, và control behavior của AI system trong production.

## Điểm Chính

- <strong>Tại sao khác traditional observability</strong>: LLM output không có "correct answer" rõ ràng, latency unpredictable (TTFT + generation time), và failure modes khác — hallucination, irrelevance, toxicity.
- <strong>Tracing</strong>: mỗi request tạo trace span tree — root span (user request) → child spans (LLM call, tool calls, retrieval) — giúp identify bottleneck và trace root cause.
- <strong>LangFuse</strong>: open-source LLM observability platform — traces, evals, prompt management, cost tracking — self-host hoặc cloud.
- <strong>Key metrics</strong>: TTFT (Time To First Token — perceived latency), total latency, input/output tokens, cost per request, error rate, hallucination rate.
- <strong>Evals (Evaluations)</strong>: automated tests đo quality của LLM output — factuality, relevance, faithfulness (RAG), toxicity, format compliance.
- <strong>LLM-as-judge</strong>: dùng một LLM mạnh (GPT-4o) để evaluate output của LLM khác theo rubric — scalable hơn human annotation.
- <strong>Guardrails</strong>: validate và sanitize LLM output trước khi deliver tới user hoặc execute — NeMo Guardrails, Guardrails AI, custom validators.
- <strong>Hallucination detection</strong>: self-consistency (sample nhiều lần, check agreement), citation verification (verify claim against source), RAGAS (evaluate RAG faithfulness).

## Ví Dụ Code

*LangFuse integration cho AI agent — distributed tracing, LLM-as-judge eval, và output guardrails*

```python
import asyncio
import json
import re
from typing import Optional
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context
from openai import AsyncOpenAI

client = AsyncOpenAI()
langfuse = Langfuse(
    public_key="pk-lf-...",
    secret_key="sk-lf-...",
    host="https://cloud.langfuse.com"  # Or self-hosted URL
)

# ─── Tracing với @observe decorator ──────────────────────────────────────────

@observe(name="rag-qa-pipeline")
async def rag_qa(question: str, user_id: str) -> dict:
    """Full RAG Q&A pipeline with automatic tracing."""

    # LangFuse auto-captures: start time, end time, input, output
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["rag", "production"],
        metadata={"question_length": len(question)}
    )

    # Retrieval step — traced as child span
    docs = await retrieve_documents(question)

    # Generation step — traced as child span
    answer = await generate_answer_with_tracing(question, docs)

    # Score the response (async eval — non-blocking)
    asyncio.create_task(
        evaluate_response(question, answer, docs, user_id)
    )

    return {"answer": answer, "sources": [d["id"] for d in docs]}


@observe(name="retrieval")
async def retrieve_documents(query: str) -> list[dict]:
    """Simulate vector retrieval — traced automatically."""
    await asyncio.sleep(0.05)  # Simulate DB query
    return [
        {"id": "doc-001", "content": "The return policy allows 30-day returns for all products."},
        {"id": "doc-002", "content": "Refunds are processed within 3-5 business days."}
    ]


@observe(name="llm-generation", as_type="generation")
async def generate_answer_with_tracing(question: str, docs: list[dict]) -> str:
    """LLM call with token tracking via @observe."""
    context = "\n".join(d["content"] for d in docs)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Answer based only on the provided context."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
        ]
    )
    # LangFuse decorator auto-captures usage (tokens, cost) for @observe(as_type="generation")
    return response.choices[0].message.content

# ─── LLM-as-Judge Evaluation ─────────────────────────────────────────────────

EVAL_PROMPT = """Evaluate this RAG response on three dimensions.

Question: {question}
Retrieved Context: {context}
Answer: {answer}

Score each from 0-10 and explain:

FAITHFULNESS (0-10): Is every claim in the answer supported by the context? 10=fully grounded, 0=hallucination
RELEVANCE (0-10): Does the answer actually address the question? 10=perfectly relevant, 0=off-topic
COMPLETENESS (0-10): Does the answer cover all aspects of the question using available context?

Respond as JSON: {{"faithfulness": N, "relevance": N, "completeness": N, "reasoning": "..."}}"""

async def evaluate_response(question: str, answer: str, docs: list[dict], trace_id: str):
    """LLM-as-judge evaluation posted back to LangFuse."""
    context = "\n".join(d["content"] for d in docs)
    eval_response = await client.chat.completions.create(
        model="gpt-4o",  # Use stronger model as judge
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": EVAL_PROMPT.format(
            question=question, context=context, answer=answer
        )}]
    )
    scores = json.loads(eval_response.choices[0].message.content)

    # Post scores to LangFuse trace
    for metric, score in scores.items():
        if metric != "reasoning" and isinstance(score, (int, float)):
            langfuse.score(
                trace_id=trace_id,
                name=metric,
                value=score / 10.0,  # Normalize to 0-1
                comment=scores.get("reasoning", "")
            )

# ─── Output Guardrails ────────────────────────────────────────────────────────

class OutputGuardrails:
    BLOCKED_PATTERNS = [
        r"\b(password|secret|api.?key|token)\b.*[:=]\s*\S+",  # Credential leakage
        r"\b(competitor_name_1|competitor_name_2)\b",           # Competitor mentions
    ]
    MAX_RESPONSE_LENGTH = 2000

    def validate(self, response: str) -> tuple[str, list[str]]:
        """Validate and sanitize LLM output. Returns (safe_response, violations)."""
        violations = []

        # Length check
        if len(response) > self.MAX_RESPONSE_LENGTH:
            response = response[:self.MAX_RESPONSE_LENGTH] + "..."
            violations.append("response_truncated")

        # Pattern checks
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, response, re.IGNORECASE):
                violations.append(f"blocked_pattern: {pattern[:30]}")
                response = "[Response filtered for policy compliance]"
                break

        # Log violations to LangFuse
        if violations:
            langfuse.event(
                name="guardrail_violation",
                metadata={"violations": violations}
            )

        return response, violations

guardrails = OutputGuardrails()

async def safe_agent_response(question: str, user_id: str) -> str:
    result = await rag_qa(question, user_id)
    safe_answer, violations = guardrails.validate(result["answer"])
    if violations:
        print(f"[GUARDRAIL] Violations: {violations}")
    return safe_answer
```

## Ứng Dụng Thực Tế

Trong production RAG system phục vụ 10K+ daily queries, LangFuse dashboard cho thấy faithfulness score trung bình 8.2/10 nhưng drop xuống 5.8/10 với câu hỏi về pricing — dẫn đến investigate và phát hiện pricing documents outdated. Guardrails block 0.3% responses có potential credential leakage từ context documents được inject vào RAG.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Làm thế nào debug khi agent cho kết quả sai mà không biết nguyên nhân?</strong></summary>

**A:** Structured debugging với tracing: (1) Xem trace span tree trong LangFuse/LangSmith — identify chính xác bước nào (retrieval, generation, tool call) cho output sai; (2) Check retrieval quality — retrieved documents có relevant không? Nếu retrieval trả về wrong docs thì issue ở embedding/search, không phải LLM; (3) Prompt inspection — actual prompt gửi đến LLM là gì? System prompt có bị override không?; (4) LLM response raw — trước khi parse/post-process, LLM nói gì?; (5) Reproduce với temp=0 để deterministic — loại bỏ randomness; (6) Compare với golden dataset nếu có. Tracing là điều kiện tiên quyết — không có trace thì debugging như mò kim đáy bể.

</details>

<details>
<summary><strong>Evals là gì và tại sao quan trọng trong AI development workflow?</strong></summary>

**A:** Evals là automated tests đo quality của LLM output — tương tự unit tests nhưng cho AI behavior. Có ba loại: (1) Code-based evals — exact match, regex, JSON schema validation — nhanh và deterministic; (2) Model-based evals (LLM-as-judge) — dùng LLM mạnh evaluate theo rubric, scalable cho open-ended responses; (3) Human evals — ground truth nhưng expensive và slow. Quan trọng vì: detect regression khi thay đổi prompt hay model, measure improvement khi iterate, và làm "test suite" trước khi deploy changes. Không có evals, team không biết thay đổi có giúp hay làm hại quality — "vibes-based" development không scale.

</details>

<details>
<summary><strong>Guardrails hoạt động thế nào và khi nào nên implement?</strong></summary>

**A:** Guardrails là validation layer giữa LLM output và end user/action execution. Có hai loại: (1) Input guardrails — validate và sanitize user input trước khi gửi đến LLM (prompt injection, PII detection); (2) Output guardrails — validate LLM response trước khi trả về (harmful content, hallucinated facts, policy violations). Implement ở hai cấp: rule-based (regex, keyword filters — fast, zero cost) và model-based (chạy second LLM để classify output — accurate nhưng adds latency và cost). Nên implement khi: agent có thể execute real actions (financial transactions, email sending), response may contain sensitive data, hay compliance requirements. Không phải mọi chatbot đều cần heavy guardrails — balance security với latency/cost.

</details>
