---
key: "prompt-engineering"
title: "Prompt Engineering cho Production"
crumb: "17. AI & Agents › Production AI"
---

Prompt engineering trong production không phải nghệ thuật — là kỹ thuật có hệ thống: structure rõ ràng, few-shot examples, structured output, và defense chống prompt injection.

## Điểm Chính

- <strong>System prompt structure</strong>: Role → Context → Constraints → Output format — thứ tự quan trọng, LLM đọc từ trên xuống, đặt constraints sớm để ảnh hưởng toàn bộ response.
- <strong>Few-shot prompting</strong>: đưa 2-5 examples (input → expected output) vào prompt — hiệu quả nhất khi task có format cụ thể hoặc tone đặc trưng.
- <strong>Chain-of-Thought (CoT)</strong>: thêm "Think step by step" hoặc show reasoning trong examples — LLM giải thích trung gian trước khi đưa answer, cải thiện accuracy trên reasoning tasks.
- <strong>Structured output</strong>: yêu cầu JSON response với schema cụ thể dùng `response_format: {"type": "json_object"}` hoặc Pydantic model với instructor library.
- <strong>Prompt injection defense</strong>: user input có thể contain instructions cố gắng override system prompt — cần sanitize input và validate output.
- <strong>Temperature</strong>: 0.0 cho deterministic tasks (extraction, classification), 0.7-1.0 cho creative tasks (writing, brainstorming).
- <strong>Token efficiency</strong>: verbose prompts tăng cost và latency, không tăng quality — dùng bullet points thay vì paragraphs dài.
- <strong>Prompt versioning</strong>: treat prompts như code — version control, A/B test với evals, không change production prompt mà không measure impact.

## Ví Dụ Code

*Production-ready prompt patterns: structured output với Pydantic, CoT extraction, và injection defense*

```python
import json
import re
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from openai import AsyncOpenAI
import instructor

client = instructor.from_openai(AsyncOpenAI())

# ─── Structured Output với Pydantic + instructor ────────────────────────────

class SentimentLabel(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class ProductReviewAnalysis(BaseModel):
    sentiment: SentimentLabel
    confidence: float = Field(ge=0.0, le=1.0)
    key_issues: list[str] = Field(max_length=5, description="Main problems mentioned")
    positive_aspects: list[str] = Field(max_length=5)
    suggested_category: str = Field(description="Product category inferred from review")
    requires_follow_up: bool = Field(description="True if customer seems angry or issue unresolved")

    @field_validator("key_issues", "positive_aspects")
    @classmethod
    def limit_items(cls, v):
        return v[:5]  # Enforce max 5 items even if LLM tries to return more

async def analyze_review(review_text: str) -> ProductReviewAnalysis:
    """Structured extraction with automatic validation and retry."""
    system_prompt = """You are a product review analyst for an e-commerce platform.
Extract structured information from customer reviews.

Rules:
- confidence: how certain you are about sentiment (0.0 = uncertain, 1.0 = very certain)
- key_issues: only actual problems the customer mentions, max 5
- requires_follow_up: true if review score would be 1-2 stars or customer uses angry language"""

    return await client.chat.completions.create(
        model="gpt-4o-mini",
        response_model=ProductReviewAnalysis,  # instructor handles schema + retry
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Review: {review_text}"}
        ],
        max_retries=2  # Auto-retry if JSON schema validation fails
    )

# ─── Chain-of-Thought for Complex Reasoning ─────────────────────────────────

COT_SYSTEM_PROMPT = """You are a pricing strategy assistant. When analyzing pricing questions, ALWAYS:
1. First identify all relevant factors
2. Consider each factor's impact
3. Reason through trade-offs
4. Then give your final recommendation

Format your response as:
ANALYSIS:
- Factor 1: [impact]
- Factor 2: [impact]

TRADE-OFFS: [key trade-offs]

RECOMMENDATION: [final answer with reasoning]"""

# ─── Prompt Injection Defense ───────────────────────────────────────────────

DANGEROUS_PATTERNS = [
    r"ignore (all |previous |above )?instructions",
    r"you are now",
    r"system prompt",
    r"forget (everything|all)",
    r"pretend (you are|to be)",
    r"</?(system|instructions?)>",
    r"new role:",
]

def sanitize_user_input(user_input: str, max_length: int = 2000) -> tuple[str, list[str]]:
    """Sanitize user input and return (cleaned_input, detected_threats)."""
    threats_detected = []
    cleaned = user_input[:max_length]  # Hard length limit

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            threats_detected.append(pattern)

    # Wrap user input in clear delimiters so LLM knows what's user-provided
    wrapped = f"<user_input>{cleaned}</user_input>"
    return wrapped, threats_detected

def build_safe_prompt(system: str, user_message: str) -> list[dict]:
    """Build messages with injection-resistant structure."""
    sanitized, threats = sanitize_user_input(user_message)

    if threats:
        # Log security event in production
        print(f"[SECURITY] Potential injection detected: {threats}")
        # Optionally reject or quarantine
        sanitized = "<user_input>[Message filtered for security]</user_input>"

    # Reinforce system prompt after user message to reduce injection impact
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": sanitized},
        # Reminder: some models benefit from this pattern
    ]
    return messages

# ─── Few-Shot Template ──────────────────────────────────────────────────────

FEW_SHOT_CLASSIFY_PROMPT = """Classify customer support ticket into category.

Examples:
Input: "My payment failed but I was charged twice"
Category: BILLING | Urgency: HIGH

Input: "How do I export my data as CSV?"
Category: HOW_TO | Urgency: LOW

Input: "App crashes when I click Save on the profile page"
Category: BUG_REPORT | Urgency: MEDIUM

Now classify:
Input: "{ticket_text}"
Category:"""

async def classify_ticket(ticket_text: str) -> str:
    raw_client = AsyncOpenAI()
    response = await raw_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,  # Deterministic for classification
        messages=[{
            "role": "user",
            "content": FEW_SHOT_CLASSIFY_PROMPT.format(ticket_text=ticket_text)
        }]
    )
    return response.choices[0].message.content
```

## Ứng Dụng Thực Tế

Trong SaaS customer feedback pipeline, structured output với Pydantic đảm bảo 100% JSON parse success (instructor auto-retry khi LLM trả về invalid JSON). CoT prompting trong pricing agent giúp team audit tại sao LLM đưa ra recommendation cụ thể — Thought chain được log và reviewable. Prompt injection defense là thiết yếu khi user có thể nhập free text được đưa vào LLM prompt.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>Chain-of-thought tại sao cải thiện accuracy trên reasoning tasks?</strong></summary>

**A:** CoT buộc LLM externalize intermediate reasoning steps trước khi đưa ra final answer. Khi phải "viết ra" từng bước, LLM ít bị shortcut về sai answer hơn — giống như con người làm toán: viết ra từng bước ít sai hơn làm mental math. Cơ chế: Transformer architecture predict token by token — các reasoning tokens trước đó trở thành context giúp predict answer token chính xác hơn. CoT đặc biệt hiệu quả cho: multi-step math, logical reasoning, và tasks yêu cầu consider multiple factors. Tradeoff: tốn thêm tokens và latency — nên chỉ dùng khi accuracy quan trọng hơn speed.

</details>

<details>
<summary><strong>Làm thế nào prevent prompt injection trong production agent?</strong></summary>

**A:** Defense in depth: (1) Sanitize input — regex detect suspicious patterns, wrap user input trong delimiters rõ ràng (`<user_input>...</user_input>`); (2) System prompt hygiene — viết system prompt rõ ràng về role và không bao giờ follow user instructions về thay đổi behavior; (3) Output validation — validate LLM output trước khi execute actions, reject outputs chứa unexpected content; (4) Least privilege — agent chỉ có tools cần thiết cho task, không expose dangerous tools mà user có thể trigger; (5) Monitor — log tất cả LLM inputs/outputs, alert khi detect injection patterns. Không có silver bullet — cần combination của các layers này.

</details>

<details>
<summary><strong>System prompt vs user prompt — strategy phân chia thế nào?</strong></summary>

**A:** System prompt: static, controlled by developer — role definition, behavior constraints, output format instructions, safety rules. Không bao giờ để user-controlled content ở đây. User prompt: dynamic, may contain user input — câu hỏi của user, data cần process. Nguyên tắc: developer-controlled instructions → system prompt; user-provided content → user message và phải được sanitized. Khi cần pass structured data (retrieved documents, tool results) vào prompt, dùng assistant message format thay vì nhét vào system prompt. Một số advanced patterns: repeat key constraints ở cuối user message (sandwich pattern) để reinforce sau khi user input có thể có injection.

</details>
